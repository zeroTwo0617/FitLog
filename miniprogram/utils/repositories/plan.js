const cloud = require('../cloud.js')

function list(limit) {
  const query = cloud.db().collection(cloud.C.PLANS)
  const request = limit ? query.limit(limit).get() : cloud.getAll(cloud.C.PLANS, 100).then((data) => ({ data: data }))
  return request.then((res) => (res && res.data) || res || [])
}
function get(id) { return cloud.db().collection(cloud.C.PLANS).doc(id).get() }
function save(plan) { return cloud.callFunction('savePlan', plan) }
function remove(id) { return cloud.callFunction('deletePlan', { id: id }) }
function count() { return cloud.db().collection(cloud.C.PLANS).count() }

module.exports = { list, get, save, remove, count }
