document.addEventListener("DOMContentLoaded", () => {
    // THEME TOGGLE
    const themeSwitch = document.getElementById('theme-switch');
    const body = document.body;
    if (localStorage.getItem('theme') === 'light') {
        body.classList.add('light-theme');
        if (themeSwitch) themeSwitch.checked = true;
    }
    if (themeSwitch) {
        themeSwitch.addEventListener('change', function () {
            if (this.checked) {
                body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
                this.setAttribute('aria-checked', 'true');
            } else {
                body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
                this.setAttribute('aria-checked', 'false');
            }
        });
    }

    const socket = io(window.location.origin, { transports: ['websocket'] });
    const leaderboardBody = document.getElementById("leaderboard-body");
    const timerDisplay = document.querySelector(".timer-display");
    const flagDisplay = document.querySelector(".flag-display");

    let currentRace = null;
    let raceData = {};
    let raceStatus = {
        running: false,
        mode: "Danger",
        remainingTime: 0,
        timerDuration: 600
    };
    let currentLapStartTimes = {};
    let updateInterval = null;
    let previousRaceData = null;
    let lastTimerUpdate = null;
    let localTimerInterval = null;
    let currentRemainingTime = 0;
    let currentRaceId = null;
    const serverTimeOffset = 0;

    // Load data from localStorage on initialization
    const savedRaceData = localStorage.getItem('raceData');
    const savedLapStartTimes = localStorage.getItem('currentLapStartTimes');
    const savedPreviousRaceData = localStorage.getItem('previousRaceData');
    const savedRaceStatus = localStorage.getItem('raceStatus');
    const savedCurrentRaceId = localStorage.getItem('currentRaceId');

    if (savedRaceData && savedLapStartTimes) {
        try {
            raceData = JSON.parse(savedRaceData);
            currentLapStartTimes = JSON.parse(savedLapStartTimes);
            if (savedPreviousRaceData) {
                previousRaceData = JSON.parse(savedPreviousRaceData);
            }
            if (savedRaceStatus) {
                raceStatus = JSON.parse(savedRaceStatus);
                if (raceStatus.running && raceStatus.remainingTime !== undefined) {
                    currentRemainingTime = raceStatus.remainingTime * 1000 + 1000;
                }
                updateFlagDisplay(raceStatus.mode);
            }
            if (savedCurrentRaceId) {
                currentRaceId = savedCurrentRaceId;
            }

            if (raceStatus.running || previousRaceData) {
                updateLeaderboard();
                startUpdateInterval();
                updateTimerDisplay();
            }
        } catch (e) {
            console.error("Error parsing stored race data:", e);
            localStorage.removeItem('raceData');
            localStorage.removeItem('currentLapStartTimes');
            localStorage.removeItem('previousRaceData');
            localStorage.removeItem('raceStatus');
            localStorage.removeItem('currentRaceId');
        }
    }

    function formatLapTime(timeInMs) {
        if (typeof timeInMs !== 'number') return "N/A";
        const minutes = Math.floor(timeInMs / 60000);
        const seconds = Math.floor((timeInMs % 60000) / 1000);
        const milliseconds = Math.floor((timeInMs % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }

    function initLeaderboard(race) {
        // Clear previous race data when a new race starts
        previousRaceData = null;
        localStorage.removeItem('previousRaceData');
        
        const isNewRace = currentRaceId !== race.id;
        currentRace = race;
        currentRaceId = race.id;
        localStorage.setItem('currentRaceId', race.id);

        // Only reset data if it's a new race
        if (isNewRace) {
            raceData = {};
            currentLapStartTimes = {};
        }

        if (race?.drivers) {
            race.drivers.forEach(driver => {
                const carNumber = driver.carAssigned.replace('Car ', '');

                // Create new driver entry only if it doesn't exist or it's a new race
                if (!raceData[carNumber] || isNewRace) {
                    raceData[carNumber] = {
                        name: driver.name,
                        carAssigned: driver.carAssigned,
                        laps: 0,
                        lastLap: null,
                        bestLap: null,
                        currentLap: 0
                    };
                } else {
                    // For existing driver in same race, preserve all data
                    raceData[carNumber].name = driver.name;
                    raceData[carNumber].carAssigned = driver.carAssigned;
                }
            });
        }

        // Update localStorage with fresh data
        localStorage.setItem('raceData', JSON.stringify(raceData));
        localStorage.setItem('currentLapStartTimes', JSON.stringify(currentLapStartTimes));

        startUpdateInterval();
        updateLeaderboard();
    }

    function updateLeaderboard() {
        // Use current race data if race is running, otherwise use previous race data
        let dataToUse;
        if (raceStatus.running) {
            dataToUse = {
                raceData: raceData,
                currentLapStartTimes: currentLapStartTimes
            };
        } else if (previousRaceData) {
            dataToUse = previousRaceData;
        } else {
            leaderboardBody.innerHTML = '<tr><td colspan="7">No active race</td></tr>';
            return;
        }

        const now = Date.now();
        Object.keys(dataToUse.currentLapStartTimes).forEach(carNumber => {
            if (dataToUse.raceData[carNumber]) {
                // Only update currentLap if race is running
                if (raceStatus.running) {
                    dataToUse.raceData[carNumber].currentLap = now - dataToUse.currentLapStartTimes[carNumber];
                }
            }
        });

        const sortedDrivers = Object.values(dataToUse.raceData).sort((a, b) => {
            if (!a.bestLap && !b.bestLap) return 0;
            if (!a.bestLap) return 1;
            if (!b.bestLap) return -1;
            return a.bestLap - b.bestLap;
        });

        leaderboardBody.innerHTML = `
            <tr>
                <th>Pos</th>
                <th>Driver</th>
                <th>Car</th>
                <th>Laps</th>
                <th>Current Lap</th>
                <th>Last Lap</th>
                <th>Best Lap</th>
            </tr>
        `;

        sortedDrivers.forEach((driver, index) => {
            const row = document.createElement("tr");
            if (index < 3) row.classList.add(`position-${index + 1}`);

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${driver.name}</td>
                <td>${driver.carAssigned}</td>
                <td>${driver.laps}</td>
                <td>${formatLapTime(driver.currentLap)}</td>
                <td>${formatLapTime(driver.lastLap)}</td>
                <td>${formatLapTime(driver.bestLap)}</td>
            `;
            leaderboardBody.appendChild(row);
        });
    }

    function startUpdateInterval() {
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(updateLeaderboard, 100);
    }

    socket.on('activeRace', (race) => {
        if (race && race.active) {
            if (currentRaceId === null || race.id !== currentRaceId) {
                initLeaderboard(race);
            } else {
                // Update existing race without resetting data
                currentRace = race;
                
                // Update driver information
                if (race?.drivers) {
                    race.drivers.forEach(driver => {
                        const carNumber = driver.carAssigned.replace('Car ', '');
                        if (raceData[carNumber]) {
                            raceData[carNumber].name = driver.name;
                            raceData[carNumber].carAssigned = driver.carAssigned;
                        }
                    });
                }
                
                updateLeaderboard();
            }
        } else if (previousRaceData) {
            // When no active race, clear current race references
            currentRace = null;
            currentRaceId = null;
            localStorage.removeItem('currentRaceId');
            updateLeaderboard();
        }
    });

    socket.on('lapTimeUpdate', (data) => {
        const carNumber = data.carNumber.toString();

        if (!raceData[carNumber]) {
            const driver = currentRace?.drivers?.find(d =>
                d.carAssigned === `Car ${carNumber}`);
            if (!driver) return;

            raceData[carNumber] = {
                name: driver.name,
                carAssigned: driver.carAssigned,
                laps: 0,
                lastLap: null,
                bestLap: null,
                currentLap: 0
            };
        }

        raceData[carNumber].lastLap = data.lapTime;
        raceData[carNumber].laps = data.lapCount;
        raceData[carNumber].currentLap = 0;

        if (!raceData[carNumber].bestLap || data.lapTime < raceData[carNumber].bestLap) {
            raceData[carNumber].bestLap = data.lapTime;
        }

        currentLapStartTimes[carNumber] = Date.now();
        localStorage.setItem('raceData', JSON.stringify(raceData));
        localStorage.setItem('currentLapStartTimes', JSON.stringify(currentLapStartTimes));
    });

    socket.on('timerUpdate', (remainingTime) => {
        if (typeof remainingTime === "number") {
            currentRemainingTime = remainingTime * 1000 + 1000;
            lastTimerUpdate = Date.now();
            updateTimerDisplay();
        }
    });

    socket.on('raceUpdate', (data) => {
        console.log('Race status update:', data);
        raceStatus = data;
        updateFlagDisplay(data.mode);

        lastTimerUpdate = Date.now();
        if (data.remainingTime !== undefined) {
            currentRemainingTime = data.remainingTime * 1000 + 1000;
        }
        
        // Ensure timer shows 0 when race finishes
        if (data.mode === "Finished") {
            currentRemainingTime = 0;
        }
        
        updateTimerDisplay();

        if (data.mode === "Finished") {
            const finishTime = Date.now();
            Object.keys(currentLapStartTimes).forEach(carNumber => {
                if (raceData[carNumber]) {
                    raceData[carNumber].currentLap = finishTime - currentLapStartTimes[carNumber];
                }
            });

            previousRaceData = {
                raceData: JSON.parse(JSON.stringify(raceData)),
                currentLapStartTimes: JSON.parse(JSON.stringify(currentLapStartTimes)),
                timestamp: finishTime
            };
            localStorage.setItem('previousRaceData', JSON.stringify(previousRaceData));
            localStorage.setItem('raceStatus', JSON.stringify(raceStatus));
            localStorage.removeItem('currentRaceId');

            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = null;
            }
            if (localTimerInterval) {
                clearInterval(localTimerInterval);
                localTimerInterval = null;
            }

            updateLeaderboard();
        } else if (data.running && !updateInterval) {
            startUpdateInterval();
        }
    });

    function updateTimerDisplay() {
        if (localTimerInterval) clearInterval(localTimerInterval);

        if (raceStatus.running && currentRemainingTime > 0) {
            localTimerInterval = setInterval(() => {
                const now = Date.now();
                const elapsedMs = now - lastTimerUpdate;
                const remainingMs = Math.max(0, currentRemainingTime - elapsedMs);

                const totalSeconds = Math.floor(remainingMs / 1000);
                const displayMins = Math.floor(totalSeconds / 60);
                const displaySecs = totalSeconds % 60;
                const displayMs = Math.floor((remainingMs % 1000) / 10);

                timerDisplay.textContent = `${displayMins}:${displaySecs.toString().padStart(2, '0')}:${displayMs.toString().padStart(2, '0')}`;

                if (remainingMs <= 0) {
                    clearInterval(localTimerInterval);
                    timerDisplay.textContent = "0:00:00";
                }
            }, 100);
        } else {
            if (localTimerInterval) clearInterval(localTimerInterval);
            // Always show 0 when race is finished
            timerDisplay.textContent = "0:00:00";
        }
    }

    function updateFlagDisplay(mode) {
        const flagDisplay = document.querySelector(".flag-display");
        const flagLabel = document.querySelector(".flag-label");
        
        // Reset classes
        flagDisplay.className = "flag-display";
        flagLabel.textContent = mode;
        
        // Add appropriate flag class
        flagDisplay.classList.add(
            mode === "Safe" ? "flag-green" :
            mode === "Hazard" ? "flag-yellow" :
            mode === "Danger" ? "flag-red" : "flag-finished"
        );
    }

    window.addEventListener('beforeunload', () => {
        if (updateInterval) clearInterval(updateInterval);
        if (localTimerInterval) clearInterval(localTimerInterval);
    });

    socket.emit('getRaces');
});