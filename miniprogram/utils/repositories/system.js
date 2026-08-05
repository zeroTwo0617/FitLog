const cloud = require('../cloud.js')
function exportData() { return cloud.callFunction('exportData') }
function deleteUserData() { return cloud.callFunction('deleteUserData') }
module.exports = { exportData, deleteUserData }
