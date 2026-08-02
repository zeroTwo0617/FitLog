const cloud = require('../cloud.js')

function listAll() { return cloud.getAll(cloud.C.BODY, 100) }
function latest() {
  return cloud.db().collection(cloud.C.BODY).orderBy('dateStr', 'desc').limit(1).get()
    .then((res) => (res && res.data) || [])
}
function save(data) { return cloud.callFunction('saveBodyMetric', data) }

module.exports = { listAll, latest, save }
