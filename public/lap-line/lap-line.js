// Theme switching functionality
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

toggleSwitch.addEventListener('change', switchTheme);

// Check for saved theme preference
const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
        toggleSwitch.checked = true;
    }
}

const lapTimersContainer = document.getElementById('lapTimersContainer');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.querySelector('.status-text');
const timerValue = document.querySelector('.timer-value');
let raceStartTime = null; // Track the race start time
let lastPressTimes = {}; // Track the time of the last button press of cars
let currentRace = null;
let raceTimerInterval = null;
let currentRemainingTime = 0; // New: To store the current remaining time
let lastTimerUpdate = null;   // New: To store the time of the last timer update

// Initialize Socket.IO connection
const socket = io(window.location.origin, {
  transports: ['websocket'] // force WebSocket only
});

// Function to update race timer display (now counts down)
function updateRaceTimer() {
    if (lastTimerUpdate === null) return; // Wait until we have an initial server update
    
    const now = Date.now();
    const timeElapsedSinceLastUpdate = now - lastTimerUpdate;
    lastTimerUpdate = now;
    
    currentRemainingTime -= timeElapsedSinceLastUpdate;
    
    if (currentRemainingTime < 0) {
        currentRemainingTime = 0;
        stopRaceTimer(); // Stop timer when it reaches zero
    }
    
    timerValue.textContent = formatLapTime(currentRemainingTime);
}

// Function to start race timer
function startRaceTimer() {
    if (raceTimerInterval) clearInterval(raceTimerInterval);
    raceTimerInterval = setInterval(updateRaceTimer, 100); // Update every 100ms
}

// Function to stop race timer
function stopRaceTimer() {
    if (raceTimerInterval) {
        clearInterval(raceTimerInterval);
        raceTimerInterval = null;
    }
}

// Function to update race status
function updateRaceStatus(mode, running) {
    statusIndicator.className = 'status-indicator';
    if (mode === "Danger" && !running) {
        statusIndicator.classList.add('danger');
        statusText.textContent = 'Race Ended';
    } else if (running) {
        statusIndicator.classList.add('active');
        statusText.textContent = 'Race Active';
    } else {
        statusIndicator.classList.add('warning');
        statusText.textContent = 'Waiting for Race';
    }
}

// Function to enable lap timer buttons
function enableLapTimerButtons() {
    const carButtons = document.querySelectorAll('.carButton');
    carButtons.forEach(button => {
        button.disabled = false;
    });
}

// Function to disable lap timer buttons
function disableLapTimerButtons() {
    const carButtons = document.querySelectorAll('.carButton');
    carButtons.forEach(button => {
        button.disabled = true;
    });
}

// Function to render lap timer buttons for the active race
function renderLapTimerButtons(race) {
    lapTimersContainer.innerHTML = "";

    race.drivers.forEach(driver => {
        const row = document.createElement('div');
        row.className = 'carRow';

        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'carTimeDisplay';
        timeDisplay.innerHTML = `<div>${driver.carAssigned}</div>`; // Only car number

        const lapButton = document.createElement('button');
        lapButton.textContent = driver.carAssigned;
        lapButton.className = 'carButton';
        lapButton.id = driver.carAssigned;

        lapButton.myTimeDisplay = timeDisplay;
        lapButton.carNumber = driver.carAssigned.replace("Car ", "");

        row.appendChild(timeDisplay);
        row.appendChild(lapButton);
        lapTimersContainer.appendChild(row);

        lapButton.addEventListener('click', lapTimer);
    });
}

// Function to handle lap timing when button is clicked
function lapTimer(event) {
    const lapButton = event.currentTarget;
    const timeDisplay = lapButton.myTimeDisplay;
    const carNumber = lapButton.carNumber;

    if (!raceStartTime) {
        console.error("Race has not started yet.");
        return;
    }
    if (currentRace?.duration && Date.now() - raceStartTime >= currentRace.duration * 1000) {
        console.warn("Race timer has expired. Lap not recorded.");
        return;
    }
    

    const currentTime = Date.now();
    let lapTime;

    if (!lastPressTimes[carNumber]) {
        lapTime = currentTime - raceStartTime;
    } else {
        lapTime = currentTime - lastPressTimes[carNumber];
    }

    lastPressTimes[carNumber] = currentTime;

    const formattedLap = formatLapTime(lapTime);

    if (!lapButton.dataset.bestLap || lapTime < parseInt(lapButton.dataset.bestLap)) {
        lapButton.dataset.bestLap = lapTime;
    }

    const bestLapTime = parseInt(lapButton.dataset.bestLap);
    const formattedBest = formatLapTime(bestLapTime);

    timeDisplay.innerHTML = `
        <div>${lapButton.textContent}</div>
        <span>Last Lap: ${formattedLap}</span>
        <span>Best Lap: ${formattedBest}</span>
    `;

    let lapCount = Number(lapButton.dataset.lapCount) || 0;
    lapCount += 1;
    lapButton.dataset.lapCount = lapCount;

    // Ensure we have a race ID before emitting
    if (!currentRace?.id) {
        console.error("No active race ID available");
        return;
    }

    socket.emit('saveLapTime', {
        raceId: currentRace.id,
        carNumber: parseInt(carNumber),
        lapTime: lapTime,
        formattedLap: formattedLap,
        bestLap: bestLapTime,
        formattedBest: formattedBest,
        lapCount: lapCount
    });

    // Add visual feedback for lap recording
    lapButton.style.transform = 'scale(0.95)';
    setTimeout(() => {
        lapButton.style.transform = 'scale(1)';
    }, 100);
}

// Format lap time (mm:ss:ms)
function formatLapTime(timeInMs) {
    const minutes = Math.floor(timeInMs / 60000);
    const seconds = Math.floor((timeInMs % 60000) / 1000);
    const milliseconds = timeInMs % 1000;

    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    const formattedMilliseconds = milliseconds.toString().padStart(3, '0');

    return `${formattedMinutes}:${formattedSeconds}:${formattedMilliseconds}`;
}

// Listen for active race updates
socket.on('activeRace', (race) => {
    console.log("Received active race:", race);
    currentRace = race;
    if (race && race.drivers.length > 0) {
        renderLapTimerButtons(race);
        enableLapTimerButtons();
        
        // Set the actual race start time from the server data
        if (race.startTime) {
            raceStartTime = new Date(race.startTime).getTime();
        } else {
            console.warn("activeRace event received without a startTime. Lap timer may be inaccurate.");
            raceStartTime = Date.now(); // Fallback if startTime is missing
        }

        race.drivers.forEach(driver => {
            const carNum = driver.carAssigned.replace('Car ', '');
            
            // Restore last press time based on the last recorded lap's createdAt timestamp
            // If no laps yet, set last press time to the race start time
            if (driver.LapTimes && driver.LapTimes.length > 0) {
                driver.LapTimes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const lastLap = driver.LapTimes[driver.LapTimes.length - 1];
                lastPressTimes[carNum] = new Date(lastLap.createdAt).getTime(); 
                
                // Update internal dataset for best lap and lap count, but not display
                const bestLap = Math.min(...driver.LapTimes.map(lap => lap.lapTime));
                const lapButton = document.getElementById(driver.carAssigned);
                if (lapButton) {
                    lapButton.dataset.bestLap = bestLap;
                    lapButton.dataset.lapCount = driver.LapTimes.length;
                }

            } else {
                lastPressTimes[carNum] = raceStartTime; // Initialize with race start time
            }
        });
    } else {
        // If no active race or no drivers, clear lap timers container
        lapTimersContainer.innerHTML = `
            <div class="race-ended-message">
                Waiting for drivers to be assigned...
            </div>
        `;
        stopRaceTimer();
        timerValue.textContent = "00:00:000";
        raceStartTime = null;
        lastPressTimes = {};
    }
});

// Listen for race updates
socket.on('raceUpdate', (data) => {
    console.log('Race state update:', data.mode, 'Running:', data.running);
    
    updateRaceStatus(data.mode, data.running);
    
    if (data.mode === "Danger" && !data.running) {
        disableLapTimerButtons();
        stopRaceTimer();
        
        lapTimersContainer.innerHTML = `
            <div class="race-ended-message">
                <i class="fas fa-flag-checkered"></i>
                Race Session Has Ended
            </div>
        `;
        
        raceStartTime = null; // Reset raceStartTime on race end
        lastPressTimes = {};
        timerValue.textContent = "00:00:000"; // Reset timer display on race end
    } else if (data.running) {
        enableLapTimerButtons();
        
        // Update currentRemainingTime and lastTimerUpdate from server data
        // Add 1000ms compensation to align with client's clock, similar to Leaderboard timer
        currentRemainingTime = data.remainingTime * 1000 + 1000; // Convert seconds to milliseconds and add compensation
        lastTimerUpdate = Date.now();
        
        // Start the timer only if it's not already running
        if (!raceTimerInterval) {
            startRaceTimer();
        }
    }
});

socket.on('lapTimeUpdate', (data) => {
    const { carNumber, lapTime, lapCount, bestLap, formattedLap, formattedBest } = data;
    const carId = `Car ${carNumber}`;
    const button = document.getElementById(carId);

    if (button) {
        if (!button.myTimeDisplay) {
            const row = button.parentElement;
            const timeDisplay = row.querySelector('.carTimeDisplay');
            button.myTimeDisplay = timeDisplay;
        }

        button.dataset.bestLap = bestLap;
        button.dataset.lapCount = lapCount;

        // Only display carId, no lap stats
        button.myTimeDisplay.innerHTML = `<div>${carId}</div>`;
    }
});