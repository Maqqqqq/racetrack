const { Race, Driver, LapTime } = require('../../db/database');
let io = null;

// Set the Socket.IO instance
exports.setIO = (socketIO) => {
  io = socketIO;
};

// Helper: Emit updated inactive races list to clients
async function emitInactiveRaces() {
  if (!io) {
    console.error("Socket.IO instance (io) is not initialized.");
    return;
  }
  const races = await Race.findAll({
    where: { active: false },
    include: { model: Driver, as: 'drivers' },
  });
  io.emit('racesList', races);
}

// Create a new race session
exports.createRace = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Race name is required." });

  try {
    const existingRace = await Race.findOne({ where: { name } });
    if (existingRace) {
      return res.status(400).json({ message: `Race session ${name} already exists.` });
    }

    const newRace = await Race.create({ name });
    await emitInactiveRaces();
    io?.emit('raceCreated', newRace);

    res.status(201).json(newRace);
  } catch (error) {
    console.error("createRace error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get all inactive races
exports.getAllRaces = async (req, res) => {
  try {
    const races = await Race.findAll({
      where: { active: false },
      include: { model: Driver, as: 'drivers' },
    });
    res.status(200).json(races);
  } catch (error) {
    console.error("getAllRaces error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Start the first inactive race (mark active and set start time/duration)
exports.startRace = async (durationSeconds = 180) => {
  try {
    const race = await Race.findOne({
      where: { active: false },
      include: { model: Driver, as: 'drivers' },
    });
    if (!race) {
      console.error("No inactive races found.");
      return null;
    }

    race.active = true;
    race.startTime = new Date();
    race.duration = durationSeconds;
    await race.save();

    await emitInactiveRaces();
    return race;
  } catch (error) {
    console.error("startRace error:", error);
    return null;
  }
};

// Get list of inactive races
exports.getRaces = async () => {
  return await Race.findAll({
    where: { active: false },
    include: { model: Driver, as: 'drivers' },
  });
};

// Get a race by ID
exports.getRaceById = async (req, res) => {
  const { id } = req.params;
  try {
    const race = await Race.findByPk(id, { include: { model: Driver, as: 'drivers' } });
    if (!race) return res.status(404).json({ message: "Race session not found." });
    res.status(200).json(race);
  } catch (error) {
    console.error("getRaceById error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update race and drivers info
exports.updateRace = async (req, res) => {
  const { id } = req.params;
  const { name, drivers } = req.body;

  try {
    const race = await Race.findByPk(id, { include: { model: Driver, as: 'drivers' } });
    if (!race) return res.status(404).json({ message: "Race session not found." });

    if (name) race.name = name;

    if (Array.isArray(drivers)) {
      if (drivers.length > 8) {
        return res.status(400).json({ message: "A race session can have a maximum of 8 drivers." });
      }

      const uniqueNames = new Set(drivers.map(d => d.name));
      if (uniqueNames.size !== drivers.length) {
        return res.status(400).json({ message: "Driver names must be unique within the race." });
      }

      for (const { id: driverId, name: newName, carAssigned, action } of drivers) {
        const driver = race.drivers.find(d => d.id === driverId);
        if (!driver) {
          return res.status(404).json({ message: `Driver with ID ${driverId} not found.` });
        }

        if (action === "update") {
          if (newName) driver.name = newName;
          if (carAssigned) driver.carAssigned = carAssigned;
          await driver.save();
        } else if (action === "delete") {
          await driver.destroy();
        }
      }
    }

    await race.save();

    const updatedRace = await Race.findByPk(id, { include: { model: Driver, as: 'drivers' } });
    io?.emit('raceUpdated', updatedRace);

    res.status(200).json(updatedRace);
  } catch (error) {
    console.error("updateRace error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Delete a race
exports.deleteRace = async (reqOrId, res) => {
  const id = typeof reqOrId === 'object' && reqOrId.params ? reqOrId.params.id : reqOrId;

  try {
    const race = await Race.findByPk(id);
    if (!race) {
      const response = { success: false, message: "Race not found." };
      if (res) return res.status(404).json(response);
      return response;
    }

    await race.destroy();
    await emitInactiveRaces();

    const response = { success: true, message: "Race deleted successfully." };
    if (res) return res.status(200).json(response);
    return response;
  } catch (error) {
    console.error("deleteRace error:", error);
    const response = { success: false, message: "Internal server error." };
    if (res) return res.status(500).json(response);
    return response;
  }
};

// Create a driver
exports.createDriverAndCar = async (req, res) => {
  const { id } = req.params;
  const { driverName, carId } = req.body;

  try {
    const race = await Race.findByPk(id, { include: { model: Driver, as: 'drivers' } });
    if (!race) return res.status(404).json({ message: "Race session not found." });

    if (!driverName || typeof driverName !== 'string') {
      return res.status(400).json({ message: "Driver name is required and must be a string." });
    }

    if (race.drivers.length >= 8) {
      return res.status(400).json({ message: "Race session can have a maximum of 8 drivers." });
    }

    if (race.drivers.some(d => d.name === driverName)) {
      return res.status(400).json({ message: `Driver ${driverName} already exists in this race.` });
    }

    if (isNaN(carId)) {
      return res.status(400).json({ message: "Invalid car ID. Please enter a valid number." });
    }

    if (race.drivers.some(d => d.carAssigned === `Car ${carId}`)) {
      return res.status(400).json({ message: `Car ${carId} is already assigned.` });
    }

    await Driver.create({ name: driverName, carAssigned: `Car ${carId}`, RaceId: race.id });

    const updatedRace = await Race.findByPk(id, { include: { model: Driver, as: 'drivers' } });
    io?.emit('raceUpdated', updatedRace);

    res.status(201).json({ message: `Driver ${driverName} created and assigned Car ${carId}.`, race: updatedRace });
  } catch (error) {
    console.error("createDriverAndCar error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update a driver
exports.updateDriverInRace = async (req, res) => {
  const { raceId, driverId } = req.params;
  const { name, carAssigned } = req.body;

  try {
    const race = await Race.findByPk(raceId, { include: { model: Driver, as: 'drivers' } });
    if (!race) return res.status(404).json({ message: "Race session not found." });

    const driver = race.drivers.find(d => d.id === parseInt(driverId));
    if (!driver) return res.status(404).json({ message: "Driver not found in this race." });

    if (name) driver.name = name;
    if (carAssigned) {
      const formatted = `Car ${carAssigned.replace(/^(Car\s*)+/i, '')}`;
      const carConflict = race.drivers.find(d => d.carAssigned === formatted && d.id !== driver.id);
      if (carConflict) {
        return res.status(400).json({ message: `Car ${carAssigned} is already assigned to another driver.` });
      }
      driver.carAssigned = formatted;
    }

    await driver.save();
    const updatedRace = await Race.findByPk(raceId, { include: { model: Driver, as: 'drivers' } });
    io?.emit('raceUpdated', updatedRace);

    res.status(200).json({ message: "Driver updated successfully.", driver });
  } catch (error) {
    console.error("updateDriverInRace error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Delete a driver
exports.deleteDriverFromRace = async (req, res) => {
  const { raceId, driverId } = req.params;

  try {
    const race = await Race.findByPk(raceId);
    if (!race) return res.status(404).json({ message: "Race session not found." });

    const driver = await Driver.findOne({ where: { id: driverId, RaceId: raceId } });
    if (!driver) return res.status(404).json({ message: "Driver not found in this race." });

    await driver.destroy();

    const updatedRace = await Race.findByPk(raceId, { include: { model: Driver, as: 'drivers' } });
    io?.emit('raceUpdated', updatedRace);

    res.status(200).json({ message: "Driver removed successfully." });
  } catch (error) {
    console.error("deleteDriverFromRace error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Save lap time (race must still be active)
exports.saveLapTime = async (req, res) => {
  const { id } = req.params;
  const { carNumber, lapTime, formattedLap, bestLap, formattedBest, lapCount } = req.body;

  try {
    const race = await Race.findByPk(id, { include: { model: Driver, as: 'drivers' } });
    if (!race) return res.status(404).json({ message: "Race session not found." });

    const now = Date.now();
    const raceEnd = new Date(race.startTime).getTime() + race.duration * 1000;
    if (now > raceEnd) {
      return res.status(400).json({ message: "Race has ended. No more lap times accepted." });
    }

    const driver = race.drivers.find(d => d.carAssigned === `Car ${carNumber}`);
    if (!driver) return res.status(404).json({ message: "Driver not found." });

    const newLapTime = await LapTime.create({
      lapTime,
      formattedLap,
      bestLap,
      formattedBest,
      lapCount,
      DriverId: driver.id,
    });

    io?.emit('lapTimeUpdate', {
      raceId: id,
      carNumber,
      lapTime: newLapTime.lapTime,
      formattedLap: newLapTime.formattedLap,
      bestLap: newLapTime.bestLap,
      formattedBest: newLapTime.formattedBest,
      lapCount: newLapTime.lapCount,
    });

    res.status(200).json({ message: "Lap time saved successfully.", lapTime: newLapTime });
  } catch (error) {
    console.error("saveLapTime error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get the currently active race with lap data
exports.getActiveRace = async () => {
  return await Race.findOne({
    where: { active: true },
    include: {
      model: Driver,
      as: 'drivers',
      include: [{ model: LapTime }],
    },
  });
};
