const cloud = require('../cloud.js')

function listByDate(dateStr) {
  return cloud.db().collection(cloud.C.NUTRITION_LOGS).where({ dateStr: dateStr }).get()
    .then((res) => (res && res.data) || [])
}
function listAll() { return cloud.getAll(cloud.C.NUTRITION_LOGS, 100) }
function latestPlan() {
  return cloud.db().collection(cloud.C.DIET_PLANS).orderBy('updatedAt', 'desc').limit(1).get()
    .then((res) => (res && res.data && res.data[0]) || null)
}
function save(data) { return cloud.callFunction('saveNutritionLog', data) }
function remove(id) { return cloud.callFunction('deleteNutritionLog', { id: id }) }

module.exports = { listByDate, listAll, latestPlan, save, remove }
