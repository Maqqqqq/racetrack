const express = require("express");
const router = express.Router();
const raceController = require("../controllers/raceController");

router.post("/races", raceController.createRace);
router.get("/races", raceController.getAllRaces);
router.get("/races/:id", raceController.getRaceById);
router.put("/races/:id", raceController.updateRace);
router.delete("/races/:id", raceController.deleteRace);

router.post("/races/:id/create-driver", raceController.createDriverAndCar);

router.post("/races/:id/save-lap-time", raceController.saveLapTime);

router.put("/races/:raceId/drivers/:driverId", raceController.updateDriverInRace);
router.delete("/races/:raceId/drivers/:driverId", raceController.deleteDriverFromRace);

module.exports = router;