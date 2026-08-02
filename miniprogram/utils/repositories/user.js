const cloud = require('../cloud.js')

function ensure() {
  return cloud.callFunction('ensureUser').then((result) => ({
    ok: true,
    profile: result.profile || null,
    created: !!result.created
  }))
}

function updateActive() {
  return cloud.callFunction('updateUserActive')
}

module.exports = { ensure, updateActive }
