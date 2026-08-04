const cloud = require('../cloud.js')
function exportData() { return cloud.callFunction('exportData') }
module.exports = { exportData }
