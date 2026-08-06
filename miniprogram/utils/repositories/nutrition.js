const cloud = require('../cloud.js')
const { applyOrder } = require('../queryOrder.js')

const NUTRITION_ORDER = [
  { field: 'updatedAt', direction: 'desc' },
  { field: 'createdAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]
const NUTRITION_ALL_ORDER = [
  { field: 'dateStr', direction: 'desc' },
  { field: 'updatedAt', direction: 'desc' },
  { field: 'createdAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]
const DIET_PLAN_ORDER = [
  { field: 'updatedAt', direction: 'desc' },
  { field: 'createdAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]

function listByDate(dateStr) {
  const query = applyOrder(cloud.db().collection(cloud.C.NUTRITION_LOGS).where({ dateStr: dateStr }), NUTRITION_ORDER)
  return query.get()
    .then((res) => (res && res.data) || [])
}
function listAll() { return cloud.getAll(cloud.C.NUTRITION_LOGS, 100, NUTRITION_ALL_ORDER) }
function latestPlan() {
  const query = applyOrder(cloud.db().collection(cloud.C.DIET_PLANS), DIET_PLAN_ORDER)
  return query.limit(1).get()
    .then((res) => (res && res.data && res.data[0]) || null)
}
function save(data) { return cloud.callFunction('saveNutritionLog', data) }
function remove(id) { return cloud.callFunction('deleteNutritionLog', { id: id }) }

module.exports = { listByDate, listAll, latestPlan, save, remove }
