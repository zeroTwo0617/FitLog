const cloud = require('../cloud.js')
function deleteUserData() { return cloud.callFunction('deleteUserData') }
module.exports = { deleteUserData }
