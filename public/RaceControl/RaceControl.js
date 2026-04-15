// Initialize real-time connection
const socket = io(window.location.origin, {
  transports: ['websocket']
});

// --- UI Elements ---
const raceModes = document.querySelector('.race-modes');
const startRaceButton = document.getElementById('startRace');
const endRaceButton = document.getElementById('endRace');
const nextRaceSession = document.getElementById('nextRaceSession');
const nextRaceDrivers = document.getElementById('nextRaceDrivers');

// Initially hide the end race button
endRaceButton.style.display = 'none';

// --- Event Listeners ---
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.textContent;
    setRaceMode(mode);
    
    // Show end race button only when Finished is selected
    if (mode === 'Finished') {
      endRaceButton.style.display = 'block';
    } else {
      endRaceButton.style.display = 'none';
    }
  });
});

startRaceButton.addEventListener('click', () => {
  socket.emit('start');
  endRaceButton.style.display = 'none';
});

endRaceButton.addEventListener('click', () => {
  socket.emit('endRace');
  endRaceButton.style.display = 'none';
});

// --- Helper Functions ---
function setRaceMode(mode) {
  socket.emit('setRaceMode', mode);
  updateRaceModeHighlight(mode);
}

function updateRaceModeHighlight(mode) {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === mode) {
      btn.classList.add('active');
    }
  });
}

function renderNextRace(race) {
  nextRaceDrivers.innerHTML = '';

  if (race.drivers.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No drivers yet';
    nextRaceDrivers.appendChild(li);
  } else {
    race.drivers.forEach(driver => {
      const li = document.createElement('li');
      li.textContent = `${driver.name} - ${driver.carAssigned}`;
      nextRaceDrivers.appendChild(li);
    });
  }
}

// --- Socket Event Handlers ---
socket.on('raceUpdate', data => {
  console.log(`Race mode updated to ${data.mode}, running: ${data.running}`);

  if (data.running) {
    startRaceButton.style.display = 'none';
    nextRaceSession.style.display = 'none';
    raceModes.style.display = 'flex';
  } else if (data.mode === 'Finished') {
    startRaceButton.style.display = 'block';
    nextRaceSession.style.display = 'block';
    raceModes.style.display = 'none';
  } else {
    startRaceButton.style.display = 'block';
    nextRaceSession.style.display = 'block';
    raceModes.style.display = 'flex';
  }

  updateRaceModeHighlight(data.mode);
});

socket.on('raceCreated', race => {
  console.log('Race created:', race);
  startRaceButton.disabled = false;
  socket.emit('getRaces');
});

socket.on('raceUpdated', race => {
  console.log('Race updated:', race);
  socket.emit('getRaces');
});

socket.on('raceDeleted', raceId => {
  console.log('Race deleted:', raceId);
  socket.emit('getRaces');
});

socket.on('racesList', races => {
  console.log('Received races list:', races);
  const nextRace = races[0];

  if (races.length > 0) {
    renderNextRace(nextRace);
    startRaceButton.disabled = false;
  } else {
    startRaceButton.disabled = true;
    nextRaceDrivers.innerHTML = '<li>No upcoming races</li>';
  }
});

// Initialize
socket.emit('getRaces');
