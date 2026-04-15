// Imports and basic setup
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const session = require('express-session');
const raceRoutes = require('./routes/routes');
const path = require('path');
const { clearInterval } = require('timers');
const { initDB, RaceStatus } = require('../db/database');

// Race status default values
const initialTime = process.env.TIMER_DURATION;
let timerInterval = null;
let raceStatus = { running: false, mode: "Danger", remainingTime: 0, timerDuration: initialTime };
let startedRace = null;

// Load environment variables
dotenv.config();

// Check if required environment variables are set
const requiredEnvVars = ['RECEPTIONIST_KEY', 'OBSERVER_KEY', 'SAFETY_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing environment variable ${envVar}`);
    process.exit(1);
  }
}

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  transports: ['websocket'] // enforce WebSocket
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultSessionSecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if you are using HTTPS in production
    httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'Lax' // Important for sessions to work correctly across redirects
  }
}));

// Parse URL-encoded bodies (for login form)
app.use(express.urlencoded({ extended: true }));
// Parse JSON bodies
app.use(express.json());

// Trust the first proxy in front of the app (important for session cookies if behind proxy)
app.set('trust proxy', 1);

// Race controller & Socket.IO references
const raceController = require('./controllers/raceController');
raceController.setIO(io);

// Basic role based middlware
function requireRole(role) {
  return function(req, res, next) {
    if (req.session && req.session.authenticated && req.session.role === role) {
      return next();
    } else {
      return res.redirect('/');
    }
  }
}

// Serve static files and login page
app.use(express.static(path.join(__dirname, '/../public')));

// Direct to the login page at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/login/login.html'));
});

// Login routes
app.post('/login', (req, res) => {
  const { accessKey } = req.body;
  let redirectUrl = null;
  
  if (accessKey === process.env.RECEPTIONIST_KEY) {
    req.session.authenticated = true;
    req.session.role = `receptionist`;
    redirectUrl = '/front-desk';
  } else if (accessKey === process.env.OBSERVER_KEY) {
    req.session.authenticated = true;
    req.session.role = `observer`; 
    redirectUrl = '/lap-line-tracker';
  } else if (accessKey === process.env.SAFETY_KEY) {
    req.session.authenticated = true;
    req.session.role = `safety`;
    redirectUrl = '/race-control';
  }
  
  if (redirectUrl) {
    res.json({ redirectUrl });
  } else {
    setTimeout(() => {
      res.status(401).json({ message: 'Invalid access key' });
    }, 500);
  }
});

// Routes (private)
app.get('/front-desk', requireRole('receptionist'), (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/Frontdesk/FrontDesk.html'));
});

app.get('/race-control', requireRole('safety'), (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/RaceControl/RaceControl.html'));
});

app.get('/lap-line-tracker', requireRole('observer'), (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/lap-line/lap-line.html'));
});

// Routes (public)
app.get('/next-race', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/NextRace/NextRace.html'));
});

app.get('/race-countdown', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/RaceCountdown/race-countdown.html'));
});

app.get('/race-flags', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/raceFlags/raceFlags.html'));
});

app.use("/api", raceRoutes);

app.get('/leader-board', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/Leaderboard/Leaderboard.html'));
});

app.get('/driver-login', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/DriverLogin/DriverLogin.html'));
});

app.get('/api/races/active', (req, res) => {
  const activeRace = raceController.getActiveRace();
  if (activeRace) {
    res.status(200).json({ activeRaceId: activeRace.id });
  } else {
    res.status(404).json({ message: "No active race found." });
  }
});

// Load and Save Race Status
const loadRaceStatus = async () => {
  const status = await RaceStatus.findOne();
  if (status) {
    raceStatus = {
      running: status.running,
      mode: status.mode,
      remainingTime: status.remainingTime,
      timerDuration: status.timerDuration,
    };

    if (raceStatus.running && raceStatus.remainingTime > 0) {
      startCountdown();
    }

    startedRace = await raceController.getActiveRace();
    if (startedRace) {
      io.emit("activeRace", startedRace);
    }
  } else {
    await RaceStatus.create(raceStatus);
  }
};

const saveRaceStatus = async () => {
  const status = await RaceStatus.findOne();
  if (status) {
    status.running = raceStatus.running;
    status.mode = raceStatus.mode;
    status.remainingTime = raceStatus.remainingTime;
    status.timerDuration = raceStatus.timerDuration;
    await status.save();
  }
};

const startCountdown = () => {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(async () => {
    raceStatus.remainingTime--;
    io.emit("timerUpdate", raceStatus.remainingTime);
    await saveRaceStatus();

    if (raceStatus.remainingTime <= 0) {
      clearInterval(timerInterval);
      raceStatus = { running: true, mode: "Finished", timerDuration: initialTime, timerInterval: null };
      io.emit("raceUpdate", raceStatus);
      await saveRaceStatus();
    }
  }, 1000);
};

// Socket.IO events
io.on('connection', async (socket) => {
  console.log('A user connected:', socket.id);

  socket.emit("racesList", await raceController.getRaces());
  socket.emit('message', 'Welcome to Beachside Racetrack!');
  socket.emit("raceUpdate", raceStatus);
  socket.emit("activeRace", startedRace);

  if (raceStatus.running && raceStatus.remainingTime > 0) {
    socket.emit("timerUpdate", raceStatus.remainingTime);
  }

  socket.on("start", async () => {
    if (!raceStatus.running) {
      raceStatus = {
        running: true,
        mode: "Safe",
        remainingTime: initialTime,
        timerDuration: initialTime
      };

      await saveRaceStatus();
      startCountdown();
      io.emit("raceUpdate", raceStatus);
      startedRace = await raceController.startRace();

      if (startedRace) {
        io.emit("activeRace", startedRace);
        io.emit("racesList", await raceController.getRaces());
      }
    }
  });

  socket.on("setRaceMode", async (mode) => {
    raceStatus.mode = mode;
    if (mode === "Finished") {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    io.emit("raceUpdate", raceStatus);
    await saveRaceStatus();
  });

  socket.on("endRace", async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    raceStatus = {
      running: false,
      mode: "Danger",
      remainingTime: 0,
      timerDuration: initialTime
    };

    const activeRace = await raceController.getActiveRace();
    if (activeRace) {
      const raceId = activeRace.id;
      const result = await raceController.deleteRace(raceId);
      console.log(result.message);
    } else {
      console.error("No active race found to delete.")
    }
    
    startedRace = null;
    io.emit("raceUpdate", raceStatus);
    await saveRaceStatus();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('updateRace', (race) => {
    io.emit('raceUpdated', race);
  });

  socket.on('newRace', (race) => {
    io.emit('raceCreated', race);
  });

  socket.on('deleteRace', (raceId) => {
    io.emit('raceDeleted', raceId);
  });

  socket.on('getRaces', async () => {
    const races = await raceController.getRaces();
    socket.emit('racesList', races);
  });

  socket.on('saveLapTime', async (lapData) => {
    try {
      await raceController.saveLapTime({
        params: { id: lapData.raceId },
        body: lapData
      }, {
        status: (code) => ({
          json: (data) => console.log(`Response [${code}]:`, data)
        })
      });
    } catch (error) {
      console.error('Error saving lap time:', error);
    }
  });
});

// Start the server
(async () => {
  await initDB();
  await loadRaceStatus();

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
})();