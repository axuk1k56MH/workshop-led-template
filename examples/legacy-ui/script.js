const LED_IDS = ["led1", "led2", "led3"];
const REFRESH_MS = 1500;
const API_BASE =
  new URLSearchParams(window.location.search).get("api") ||
  window.localStorage.getItem("ledWorkshopApiBase") ||
  "";

const connectionBadge = document.querySelector("#connectionBadge");
const connectionText = document.querySelector("#connectionText");
const errorMessage = document.querySelector("#errorMessage");
const offlinePanel = document.querySelector("#offlinePanel");
const retryButton = document.querySelector("#retryButton");
const chaseInterval = document.querySelector("#chaseInterval");
const chaseIntervalOutput = document.querySelector("#chaseIntervalOutput");
const chaseCycles = document.querySelector("#chaseCycles");
const chaseCyclesOutput = document.querySelector("#chaseCyclesOutput");

let refreshTimer = null;
let busy = false;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
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

function setConnection(status) {
  connectionBadge.classList.toggle("is-connected", status === "connected");
  connectionBadge.classList.toggle("is-disconnected", status === "disconnected");
  connectionBadge.classList.toggle("is-checking", status === "checking");

  connectionText.textContent =
    status === "connected" ? "Connected" : status === "disconnected" ? "Offline" : "Checking...";

  offlinePanel.classList.toggle("is-hidden", status !== "disconnected");
  setControlsDisabled(status !== "connected");
}

function setControlsDisabled(disabled) {
  document.querySelectorAll("[data-action], #allOffButton, #chaseButton, input").forEach((control) => {
    control.disabled = disabled || busy;
  });
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("is-hidden");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("is-hidden");
}

function normalizeMode(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.status === "string") return value.status;
  return "unknown";
}

function applyState(state) {
  LED_IDS.forEach((ledId) => {
    const mode = normalizeMode(state[ledId]);
    const card = document.querySelector(`[data-led="${ledId}"]`);
    const badge = document.querySelector(`#status-${ledId}`);

    card.dataset.state = mode;
    badge.textContent = mode === "blinking" ? "BLINK" : mode === "unknown" ? "???" : mode.toUpperCase();
  });
}

function setLoading(control, loading) {
  control.classList.toggle("is-loading", loading);
  const icon = control.querySelector("[aria-hidden='true']");
  if (!icon) return;

  if (loading) {
    icon.dataset.previousClass = icon.className;
    icon.className = "spinner-icon";
  } else if (icon.dataset.previousClass) {
    icon.className = icon.dataset.previousClass;
    delete icon.dataset.previousClass;
  }
}

async function refreshState() {
  if (busy) return;

  try {
    const [health, state] = await Promise.all([
      apiRequest("/api/health"),
      apiRequest("/api/leds/state"),
    ]);
    setConnection(Boolean(health.ok) ? "connected" : "disconnected");
    clearError();
    applyState(state);
  } catch (error) {
    setConnection("disconnected");
    console.error(error);
  }
}

async function runLedAction(button) {
  const ledId = button.dataset.led;
  const action = button.dataset.action;
  const slider = document.querySelector(`#interval-${ledId}`);
  const body = action === "blink" ? JSON.stringify({ interval_ms: Number(slider.value) }) : undefined;

  await runCommand(button, `/api/leds/${ledId}/${action}`, { method: "POST", body }, {
    onError: `Oops! Couldn't ${action} ${ledId.toUpperCase()}. Try again?`,
  });
}

async function runCommand(control, path, options, messages = {}) {
  busy = true;
  clearError();
  setLoading(control, true);
  setControlsDisabled(false);

  try {
    const state = await apiRequest(path, options);
    setConnection("connected");
    applyState(state);
  } catch (error) {
    setConnection("disconnected");
    showError(messages.onError || "Operation failed. Check your connection and try again.");
    console.error(error);
  } finally {
    busy = false;
    setLoading(control, false);
    setControlsDisabled(connectionBadge.classList.contains("is-disconnected"));
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

  chaseCycles.addEventListener("input", () => {
    chaseCyclesOutput.textContent = `${chaseCycles.value}x`;
  });
}

function bindButtons() {
  document.querySelectorAll("[data-action][data-led]").forEach((button) => {
    button.addEventListener("click", () => runLedAction(button));
  });

  document.querySelector("#allOffButton").addEventListener("click", (event) => {
    runCommand(event.currentTarget, "/api/preset/all-off", { method: "POST" }, {
      onError: "Couldn't turn all LEDs off. Check your connection!",
    });
  });

  document.querySelector("#chaseButton").addEventListener("click", (event) => {
    runCommand(
      event.currentTarget,
      "/api/preset/chase",
      {
        method: "POST",
        body: JSON.stringify({
          interval_ms: Number(chaseInterval.value),
          cycles: Number(chaseCycles.value),
        }),
      },
      {
        onError: "Couldn't start the chase pattern. Try again?",
      },
    );
  });

  retryButton.addEventListener("click", refreshState);
  connectionBadge.addEventListener("click", refreshState);
}

bindSliders();
bindButtons();
setConnection("checking");
refreshState();
refreshTimer = window.setInterval(refreshState, REFRESH_MS);

window.addEventListener("beforeunload", () => {
  if (refreshTimer !== null) window.clearInterval(refreshTimer);
});
