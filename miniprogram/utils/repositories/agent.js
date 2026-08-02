const cloud = require('../cloud.js')

function getSession(id) { return cloud.db().collection(cloud.C.AGENT_SESSIONS).doc(id).get() }
function updateSession(id, data) { return cloud.db().collection(cloud.C.AGENT_SESSIONS).doc(id).update({ data: data }) }
function createSession(data) { return cloud.db().collection(cloud.C.AGENT_SESSIONS).add({ data: data }) }
function serverDate() { return cloud.db().serverDate() }
module.exports = { getSession, updateSession, createSession, serverDate }
