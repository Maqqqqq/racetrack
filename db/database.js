const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

const Race = sequelize.define('Race', {
  name: { type: DataTypes.STRING, allowNull: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { timestamps: true });

const Driver = sequelize.define('Driver', {
  name: { type: DataTypes.STRING, allowNull: false },
  carAssigned: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true });

const LapTime = sequelize.define('LapTime', {
  lapTime: { type: DataTypes.FLOAT, allowNull: false },
  formattedLap: { type: DataTypes.STRING },
  bestLap: { type: DataTypes.FLOAT },
  formattedBest: { type: DataTypes.STRING },
  lapCount: { type: DataTypes.INTEGER },
}, { timestamps: true });

const RaceStatus = sequelize.define('RaceStatus', {
  running: { type: DataTypes.BOOLEAN, defaultValue: false },
  mode: { type: DataTypes.STRING, defaultValue: 'Danger' },
  remainingTime: { type: DataTypes.INTEGER, defaultValue: 0 },
  timerDuration: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: true });

Race.hasMany(Driver, { as: 'drivers', foreignKey: 'RaceId', onDelete: 'CASCADE' });
Driver.belongsTo(Race, { foreignKey: 'RaceId' });

Driver.hasMany(LapTime, { onDelete: 'CASCADE' });
LapTime.belongsTo(Driver);

const initDB = async () => {
  await sequelize.sync();
};

module.exports = { sequelize, Race, Driver, LapTime, RaceStatus, initDB };
