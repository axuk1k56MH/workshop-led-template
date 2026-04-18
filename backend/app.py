import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("led-workshop")


LED_PINS = {
    "led1": 17,
    "led2": 27,
    "led3": 22,
}

LedId = Literal["led1", "led2", "led3"]
LedMode = Literal["on", "off", "blinking"]


class BlinkRequest(BaseModel):
    interval_ms: int = Field(default=500, ge=100, le=5000)


class ChaseRequest(BaseModel):
    interval_ms: int = Field(default=200, ge=100, le=5000)
    cycles: int = Field(default=5, ge=1, le=50)


class MockGPIO:
    BCM = "BCM"
    OUT = "OUT"
    LOW = 0
    HIGH = 1

    def setmode(self, mode: str) -> None:
        logger.info("MOCK GPIO setmode(%s)", mode)

    def setup(self, pin: int, mode: str, initial: int = LOW) -> None:
        logger.info("MOCK GPIO setup(pin=%s, mode=%s, initial=%s)", pin, mode, initial)

    def output(self, pin: int, value: int) -> None:
        logger.info("MOCK GPIO output(pin=%s, value=%s)", pin, "HIGH" if value else "LOW")

    def cleanup(self) -> None:
        logger.info("MOCK GPIO cleanup()")


def load_gpio():
    if os.getenv("USE_MOCK_GPIO") == "1":
        logger.info("Using mock GPIO because USE_MOCK_GPIO=1")
        return MockGPIO()

    try:
        import RPi.GPIO as gpio  # type: ignore

        logger.info("Using RPi.GPIO")
        return gpio
    except Exception as exc:
        logger.warning("RPi.GPIO is unavailable; falling back to mock GPIO: %s", exc)
        return MockGPIO()


GPIO = load_gpio()


class LedController:
    def __init__(self) -> None:
        self._states: dict[LedId, LedMode] = {
            "led1": "off",
            "led2": "off",
            "led3": "off",
        }
        self._levels: dict[LedId, bool] = {
            "led1": False,
            "led2": False,
            "led3": False,
        }
        self._blink_tasks: dict[LedId, asyncio.Task[None]] = {}
        self._preset_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    def setup(self) -> None:
        GPIO.setmode(GPIO.BCM)
        for pin in LED_PINS.values():
            GPIO.setup(pin, GPIO.OUT, initial=GPIO.LOW)
        logger.info("GPIO initialized; all LEDs are off")

    async def shutdown(self) -> None:
        async with self._lock:
            await self._stop_all_tasks_locked()
            for led_id in LED_PINS:
                self._write_led(led_id, False)
                self._states[led_id] = "off"
        GPIO.cleanup()
        logger.info("GPIO cleanup complete")

    async def get_state(self) -> dict[LedId, LedMode]:
        async with self._lock:
            return dict(self._states)

    async def turn_on(self, led_id: LedId) -> dict[LedId, LedMode]:
        async with self._lock:
            self._validate_led(led_id)
            await self._stop_preset_locked()
            await self._stop_blink_locked(led_id)
            self._write_led(led_id, True)
            self._states[led_id] = "on"
            return dict(self._states)

    async def turn_off(self, led_id: LedId) -> dict[LedId, LedMode]:
        async with self._lock:
            self._validate_led(led_id)
            await self._stop_preset_locked()
            await self._stop_blink_locked(led_id)
            self._write_led(led_id, False)
            self._states[led_id] = "off"
            return dict(self._states)

    async def blink(self, led_id: LedId, interval_ms: int) -> dict[LedId, LedMode]:
        async with self._lock:
            self._validate_led(led_id)
            await self._stop_preset_locked()
            await self._stop_blink_locked(led_id)
            self._states[led_id] = "blinking"
            self._blink_tasks[led_id] = asyncio.create_task(
                self._blink_loop(led_id, interval_ms / 1000),
                name=f"blink-{led_id}",
            )
            return dict(self._states)

    async def all_off(self) -> dict[LedId, LedMode]:
        async with self._lock:
            await self._stop_all_tasks_locked()
            for led_id in LED_PINS:
                self._write_led(led_id, False)
                self._states[led_id] = "off"
            return dict(self._states)

    async def chase(self, interval_ms: int, cycles: int) -> dict[LedId, LedMode]:
        async with self._lock:
            await self._stop_all_tasks_locked()
            self._preset_task = asyncio.create_task(
                self._chase_loop(interval_ms / 1000, cycles),
                name="preset-chase",
            )
            return dict(self._states)

    def _validate_led(self, led_id: str) -> None:
        if led_id not in LED_PINS:
            raise HTTPException(status_code=404, detail=f"Unknown LED: {led_id}")

    def _write_led(self, led_id: str, enabled: bool) -> None:
        pin = LED_PINS[led_id]
        GPIO.output(pin, GPIO.HIGH if enabled else GPIO.LOW)
        self._levels[led_id] = enabled

    async def _blink_loop(self, led_id: LedId, interval_seconds: float) -> None:
        try:
            while True:
                async with self._lock:
                    next_level = not self._levels[led_id]
                    self._write_led(led_id, next_level)
                await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Blink task failed for %s", led_id)
            async with self._lock:
                self._write_led(led_id, False)
                self._states[led_id] = "off"

    async def _chase_loop(self, interval_seconds: float, cycles: int) -> None:
        led_ids = list(LED_PINS.keys())
        try:
            for _ in range(cycles):
                for active_led in led_ids:
                    async with self._lock:
                        for led_id in led_ids:
                            self._write_led(led_id, led_id == active_led)
                            self._states[led_id] = "on" if led_id == active_led else "off"
                    await asyncio.sleep(interval_seconds)
            async with self._lock:
                for led_id in led_ids:
                    self._write_led(led_id, False)
                    self._states[led_id] = "off"
                self._preset_task = None
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Chase preset failed")
            async with self._lock:
                for led_id in led_ids:
                    self._write_led(led_id, False)
                    self._states[led_id] = "off"
                self._preset_task = None

    async def _stop_blink_locked(self, led_id: LedId) -> None:
        task = self._blink_tasks.pop(led_id, None)
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    async def _stop_preset_locked(self) -> None:
        if self._preset_task is not None:
            task = self._preset_task
            self._preset_task = None
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    async def _stop_all_tasks_locked(self) -> None:
        await self._stop_preset_locked()
        for led_id in list(self._blink_tasks):
            await self._stop_blink_locked(led_id)


controller = LedController()


@asynccontextmanager
async def lifespan(_: FastAPI):
    controller.setup()
    try:
        yield
    finally:
        await controller.shutdown()


app = FastAPI(title="Wi-Fi LED Workshop API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/leds/state")
async def leds_state() -> dict[LedId, LedMode]:
    return await controller.get_state()


@app.post("/api/leds/{led_id}/on")
async def led_on(led_id: LedId) -> dict[LedId, LedMode]:
    return await controller.turn_on(led_id)


@app.post("/api/leds/{led_id}/off")
async def led_off(led_id: LedId) -> dict[LedId, LedMode]:
    return await controller.turn_off(led_id)


@app.post("/api/leds/{led_id}/blink")
async def led_blink(led_id: LedId, request: BlinkRequest) -> dict[LedId, LedMode]:
    return await controller.blink(led_id, request.interval_ms)


@app.post("/api/preset/all-off")
async def preset_all_off() -> dict[LedId, LedMode]:
    return await controller.all_off()


@app.post("/api/preset/chase")
async def preset_chase(request: ChaseRequest) -> dict[LedId, LedMode]:
    return await controller.chase(request.interval_ms, request.cycles)


BACKEND_UI_DIR = Path(__file__).resolve().parent.parent / "backend-ui"
if BACKEND_UI_DIR.exists():
    app.mount("/assets", StaticFiles(directory=BACKEND_UI_DIR), name="backend-ui-assets")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(BACKEND_UI_DIR / "index.html")


@app.get("/style.css")
async def stylesheet() -> FileResponse:
    return FileResponse(BACKEND_UI_DIR / "style.css")


@app.get("/script.js")
async def script() -> FileResponse:
    return FileResponse(BACKEND_UI_DIR / "script.js")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
