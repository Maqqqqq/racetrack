// Initialize real-time connection
const socket = io(window.location.origin, {
  transports: ['websocket']
});

// --- UI Element Creation ---

// Create elements
const raceModes = createDiv("raceModes");
const timer = createDiv("timer");
const startRaceButton = createButton("startRace", "Start Race", true, () => socket.emit("start"));
const endRaceButton = createDiv("endRace", "End Race", () => socket.emit("endRace"));
const nextRaceSess = createDiv("nextRaceSession");
const nextRaceDrivers = createDiv("nextRaceDrivers");
nextRaceSess.appendChild(nextRaceDrivers);

// Race mode buttons
["Safe", "Hazard", "Danger", "Finished"].forEach(mode => {
  const btn = createDiv(mode.toLowerCase(), mode, () => setRaceMode(mode));
  raceModes.appendChild(btn);
});

// --- Helper Functions ---

function createDiv(className, text = "", clickHandler) {
  const div = document.createElement("div");
  div.classList.add(className);
  div.textContent = text;
  if (clickHandler) div.addEventListener("click", clickHandler);
  return div;
}

function createButton(className, text, disabled, clickHandler) {
  const btn = document.createElement("button");
  btn.classList.add(className);
  btn.textContent = text;
  btn.disabled = disabled;
  btn.addEventListener("click", clickHandler);
  return btn;
}

function setRaceMode(mode) {
  socket.emit("setRaceMode", mode);
}

function updateRaceModeHighlight(mode) {
  document.querySelectorAll(".raceModes div").forEach(btn => btn.classList.remove("active"));
  const button = raceModes.querySelector(`.${mode.toLowerCase()}`);
  if (button) button.classList.add("active");
}

function renderNextRace(race) {
  nextRaceDrivers.innerHTML = "";
  race.drivers.forEach(driver => {
    const li = document.createElement("li");
    li.textContent = `${driver.name} - ${driver.carAssigned}`;
    nextRaceDrivers.appendChild(li);
  });
}

// --- Socket Event Handlers ---

socket.on("raceUpdate", data => {
  console.log(`Race mode updated to ${data.mode}, running: ${data.running}`);

  if (!document.body.contains(timer) && data.remainingTime > 0 && document.body.contains(startRaceButton)) {
    startRaceButton.remove();
    nextRaceSess.remove();
    document.body.append(raceModes, timer);
    timer.textContent = formatTime(data.remainingTime);
  } else if (!data.running && data.mode === "Danger") {
    endRaceButton.remove();
    document.body.append(nextRaceSess, startRaceButton);
  } else if (data.mode === "Finished") {
    timer.remove();
    raceModes.remove();
    nextRaceSess.remove();
    document.body.append(endRaceButton);
  } else if (data.running) {
    if (!document.body.contains(raceModes)) document.body.append(raceModes);
    if (!document.body.contains(timer)) document.body.append(timer);
  }

  timer.textContent = data.remainingTime === 0 && !data.running ? "" : formatTime(data.remainingTime);
  updateRaceModeHighlight(data.mode);
});

socket.on("timerUpdate", remainingTime => {
  timer.textContent = formatTime(remainingTime);
});

socket.on("raceCreated", race => {
  console.log("Race created:", race);
  startRaceButton.disabled = false;
  socket.emit("getRaces");
});

socket.on("raceUpdated", race => {
  console.log("Race updated:", race);
  socket.emit("getRaces");
});

socket.on("raceDeleted", raceId => {
  console.log("Race deleted:", raceId);
  socket.emit("getRaces");
  if (races.length === 0) startRaceButton.disabled = true;
});

socket.on("racesList", races => {
  console.log("Received races list:", races);
  const nextRace = races[0];

  if (races.length > 0 && nextRace.drivers.length > 0) {
    renderNextRace(nextRace);
    startRaceButton.disabled = false;
    nextRaceSess.textContent = "Next race session:";
    nextRaceSess.appendChild(nextRaceDrivers);
  } else {
    startRaceButton.disabled = true;
    nextRaceSess.textContent = "No upcoming races";
  }
});

socket.emit("getRaces");

// --- Utility ---

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}
