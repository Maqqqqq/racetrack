document.addEventListener("DOMContentLoaded", () => {
  const nextRaceName = document.getElementById("next-race-name");
  const nextRaceDriverCount = document.getElementById("next-race-driver-count");
  const nextRaceDrivers = document.getElementById("next-race-drivers");
  const paddockMessage = document.getElementById("paddock-message");

  const socket = io(window.location.origin, {
    transports: ['websocket'],
  });

  const refreshRaces = () => socket.emit('getRaces');

  socket.on('raceCreated', (race) => {
    console.log("[Race Created]", race);
    refreshRaces();
  });

  socket.on('raceUpdated', (race) => {
    console.log("[Race Updated]", race);
    refreshRaces();
  });

  socket.on('raceDeleted', (raceId) => {
    console.log("[Race Deleted]", raceId);
    refreshRaces();
  });

  socket.on('racesList', (races) => {
    console.log("[Races List Received]", races);
    if (Array.isArray(races) && races.length > 0) {
      renderNextRace(races[0]);
    } else {
      renderNoRace();
    }
  });

  refreshRaces();

  function renderNextRace(race) {
    if (!race || !race.name || !Array.isArray(race.drivers)) {
      return renderNoRace();
    }

    console.log("[Rendering Race]", race);

    nextRaceName.textContent = race.name;
    nextRaceDriverCount.textContent = race.drivers.length.toString();
    nextRaceDrivers.innerHTML = "";

    race.drivers.forEach(driver => {
      const li = document.createElement("li");
      li.textContent = `${driver.name} - ${driver.carAssigned || "No car assigned"}`;
      nextRaceDrivers.appendChild(li);
    });
    
    // Clear paddock message when race exists
    paddockMessage.textContent = "";
  }

  function renderNoRace() {
    console.log("[No Upcoming Races]");
    nextRaceName.textContent = "No upcoming races.";
    nextRaceDriverCount.textContent = "0";
    nextRaceDrivers.innerHTML = "";
    paddockMessage.textContent = "Racers, please proceed to paddock";
  }
});