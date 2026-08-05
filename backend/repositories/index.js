// repositories/index.js
const areaRepository = require("./area.repository");
const userRepository = require("./user.repository");
const citizenRepository = require("./citizen.repository");
const scheduleRepository = require("./schedule.repository");
const complaintRepository = require("./complaint.repository");
const actionRepository = require("./action.repository");
const analyticsRepository = require("./analytics.repository");

module.exports = {
  areaRepository,
  userRepository,
  citizenRepository,
  scheduleRepository,
  complaintRepository,
  actionRepository,
  analyticsRepository,
};
