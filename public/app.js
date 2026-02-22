const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authText = document.getElementById("authText");
const resultText = document.getElementById("result");
const vacuumBtn = document.getElementById("vacuumBtn");
const fullCleanBtn = document.getElementById("fullCleanBtn");
const calendarFrame = document.getElementById("calendarFrame");
const darkCalendarToggle = document.getElementById("darkCalendarToggle");
const COOLDOWN_SECONDS = 15;
let cooldownUntil = 0;
let cooldownInterval = null;

const picker = flatpickr("#scheduleTime", {
  enableTime: true,
  dateFormat: "Y-m-d H:i",
  minuteIncrement: 15,
  defaultDate: new Date()
});

async function checkAuthState() {
  const response = await fetch("/api/auth/status");
  const { authenticated, email } = await response.json();
  if (authenticated) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    authText.textContent = email
      ? `Connected as ${email}.`
      : "Connected to Google Calendar.";
  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    authText.textContent = "Please sign in to create events.";
  }
}

async function loadCalendarEmbed() {
  const response = await fetch("/api/embed-url");
  const data = await response.json();
  calendarFrame.src = data.embedUrl;
}

function applyCalendarFilter(enabled) {
  if (enabled) {
    calendarFrame.classList.add("dark-filter");
  } else {
    calendarFrame.classList.remove("dark-filter");
  }
}

async function createEvent(type) {
  if (Date.now() < cooldownUntil) {
    const secondsLeft = Math.ceil((cooldownUntil - Date.now()) / 1000);
    resultText.classList.add("error");
    resultText.textContent = `Please wait ${secondsLeft}s before creating another event.`;
    return;
  }

  resultText.classList.remove("error");
  resultText.textContent = "Creating event...";

  const selectedDate = picker.selectedDates[0];
  if (!selectedDate) {
    resultText.classList.add("error");
    resultText.textContent = "Please pick a date and time.";
    return;
  }

  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      startDateTime: selectedDate.toISOString()
    })
  });

  const data = await response.json();
  if (!response.ok) {
    resultText.classList.add("error");
    resultText.textContent = data.error || "Failed to create event.";
    startCooldown();
    return;
  }

  if (data.eventLink) {
    resultText.innerHTML = `Scheduled: <a href="${data.eventLink}" target="_blank" rel="noopener noreferrer">${type}</a>`;
  } else {
    resultText.textContent = `Scheduled: ${type}`;
  }

  startCooldown();
}

function setButtonsDisabled(disabled) {
  vacuumBtn.disabled = disabled;
  fullCleanBtn.disabled = disabled;
}

function updateCooldownDisplay() {
  const remainingMs = cooldownUntil - Date.now();
  if (remainingMs <= 0) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
    cooldownUntil = 0;
    setButtonsDisabled(false);
    return;
  }

  const secondsLeft = Math.ceil(remainingMs / 1000);
  vacuumBtn.textContent = `Vacuum Only (${secondsLeft}s)`;
  fullCleanBtn.textContent = `Full Clean (${secondsLeft}s)`;
}

function startCooldown() {
  cooldownUntil = Date.now() + COOLDOWN_SECONDS * 1000;
  setButtonsDisabled(true);

  if (cooldownInterval) {
    clearInterval(cooldownInterval);
  }

  updateCooldownDisplay();
  cooldownInterval = setInterval(() => {
    updateCooldownDisplay();
    if (cooldownUntil === 0) {
      vacuumBtn.textContent = "Vacuum Only";
      fullCleanBtn.textContent = "Full Clean";
    }
  }, 250);
}

vacuumBtn.addEventListener("click", () => createEvent("Vacuum Only"));
fullCleanBtn.addEventListener("click", () => createEvent("Full Clean"));
logoutBtn.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  await checkAuthState();
  resultText.textContent = "";
});

darkCalendarToggle.addEventListener("change", () => {
  const enabled = darkCalendarToggle.checked;
  localStorage.setItem("darkCalendarFilter", enabled ? "1" : "0");
  applyCalendarFilter(enabled);
});

const savedDarkCalendar = localStorage.getItem("darkCalendarFilter");
const darkEnabled = savedDarkCalendar === null ? true : savedDarkCalendar === "1";
darkCalendarToggle.checked = darkEnabled;
applyCalendarFilter(darkEnabled);

checkAuthState();
loadCalendarEmbed();
