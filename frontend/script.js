const LED_IDS = ["led1", "led2", "led3"];
const REFRESH_MS = 1500;

const healthDot = document.querySelector("#healthDot");
const healthText = document.querySelector("#healthText");
const chaseInterval = document.querySelector("#chaseInterval");
const chaseIntervalOutput = document.querySelector("#chaseIntervalOutput");
const chaseCycles = document.querySelector("#chaseCycles");

let refreshTimer = null;
let busy = false;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  return response.json();
}

function setHealth(ok, message) {
  healthDot.classList.toggle("is-ok", ok);
  healthDot.classList.toggle("is-error", !ok);
  healthText.textContent = message;
}

function applyState(state) {
  LED_IDS.forEach((ledId) => {
    const mode = state[ledId] || "off";
    const card = document.querySelector(`[data-led="${ledId}"]`);
    const lamp = document.querySelector(`#lamp-${ledId}`);
    const stateText = document.querySelector(`#state-${ledId}`);

    card.dataset.state = mode;
    lamp.className = `lamp is-${mode}`;
    stateText.textContent = mode;
  });
}

async function refreshState() {
  if (busy) return;

  try {
    const [health, state] = await Promise.all([
      apiRequest("/api/health"),
      apiRequest("/api/leds/state"),
    ]);
    setHealth(Boolean(health.ok), "接続中");
    applyState(state);
  } catch (error) {
    setHealth(false, "未接続");
    console.error(error);
  }
}

async function runLedAction(ledId, action) {
  const slider = document.querySelector(`#interval-${ledId}`);
  const body = action === "blink" ? JSON.stringify({ interval_ms: Number(slider.value) }) : undefined;

  await runCommand(`/api/leds/${ledId}/${action}`, { method: "POST", body });
}

async function runCommand(path, options) {
  busy = true;
  document.body.classList.add("is-busy");

  try {
    const state = await apiRequest(path, options);
    setHealth(true, "接続中");
    applyState(state);
  } catch (error) {
    setHealth(false, "操作失敗");
    console.error(error);
  } finally {
    busy = false;
    document.body.classList.remove("is-busy");
  }
}

function bindSliders() {
  LED_IDS.forEach((ledId) => {
    const slider = document.querySelector(`#interval-${ledId}`);
    const output = document.querySelector(`#interval-output-${ledId}`);
    slider.addEventListener("input", () => {
      output.textContent = `${slider.value}ms`;
    });
  });

  chaseInterval.addEventListener("input", () => {
    chaseIntervalOutput.textContent = `${chaseInterval.value}ms`;
  });
}

function bindButtons() {
  document.querySelectorAll("[data-action][data-led]").forEach((button) => {
    button.addEventListener("click", () => {
      runLedAction(button.dataset.led, button.dataset.action);
    });
  });

  document.querySelector("#allOffButton").addEventListener("click", () => {
    runCommand("/api/preset/all-off", { method: "POST" });
  });

  document.querySelector("#chaseButton").addEventListener("click", () => {
    runCommand("/api/preset/chase", {
      method: "POST",
      body: JSON.stringify({
        interval_ms: Number(chaseInterval.value),
        cycles: Number(chaseCycles.value),
      }),
    });
  });
}

bindSliders();
bindButtons();
refreshState();
refreshTimer = window.setInterval(refreshState, REFRESH_MS);

window.addEventListener("beforeunload", () => {
  if (refreshTimer !== null) window.clearInterval(refreshTimer);
});
