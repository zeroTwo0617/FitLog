const cloud = require('../cloud.js')
function exportData() { return cloud.callFunction('exportData') }
function seedData(mode) { return cloud.callFunction('seedData', mode ? { mode: mode } : {}) }
module.exports = { exportData, seedData }
