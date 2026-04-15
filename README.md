# Beachside Racetrack Management System

A comprehensive web-based system for managing and monitoring racetrack operations, including race control, lap tracking, and front desk management.

## Features

- **Role-based Access Control**
  - Receptionist Dashboard
  - Race Control Panel
  - Lap Line Tracking
  - Safety Management

- **Real-time Race Management**
  - Race countdown timer
  - Race status monitoring
  - Lap tracking
  - Leaderboard display
  - Race flags system

- **Public Displays**
  - Next race information
  - Race countdown
  - Race flags
  - Leaderboard

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
```
git clone https://gitea.kood.tech/markusstamm/racetrack.git
cd racetrack
```

2. Install dependencies:
```
npm install
```

3. Create `.env` from `.env.example`.
```
cp .env.example .env
```

## Running the Application

### Development Mode
```
npm run dev
```
This starts the server in development mode with a 60-second timer duration.

### Production Mode
```
npm start
```
This starts the server in production mode with a 600-second (10-minute) timer duration.

## Access Points

- **Front Desk**: `/front-desk`
- **Race Control**: `/race-control`
- **Lap Line Tracker**: `/lap-line-tracker`
- **Public Displays**:
  - Next Race: `/next-race`
  - Race Countdown: `/race-countdown`
  - Race Flags: `/race-flags`
  - Leaderboard: `/leader-board`

## Main Priority

The main priority of this system is to provide a safe and efficient way to manage racetrack operations. The system focuses on:

1. **Safety First**: Real-time race status monitoring and control
2. **Efficient Race Management**: Automated timing and lap tracking
3. **Clear Communication**: Public displays for race information
4. **Role-based Access**: Secure access to different management functions

## Technical Stack

- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.IO
- **Database**: SQLite with Sequelize ORM
- **Session Management**: Express-session
- **Environment Variables**: dotenv

## Security

- Role-based authentication system
- Secure session management
- Environment variable protection
- WebSocket-only communication for real-time features
