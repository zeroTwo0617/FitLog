const cloud = require('../cloud.js')
const { applyOrder } = require('../queryOrder.js')

const PLAN_ORDER = [
  { field: 'updatedAt', direction: 'desc' },
  { field: 'createdAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]

function list(limit) {
  const query = applyOrder(cloud.db().collection(cloud.C.PLANS), PLAN_ORDER)
  const requested = Number(limit)
  const bounded = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 0
  const request = bounded > 0 && bounded <= 20
    ? query.limit(bounded).get()
    : (typeof cloud.getAll === 'function'
      ? cloud.getAll(cloud.C.PLANS, 20, PLAN_ORDER).then((data) => ({ data: bounded ? data.slice(0, bounded) : data }))
      : query.limit(20).get())
  return request.then((res) => (res && res.data) || res || [])
}
function get(id) { return cloud.db().collection(cloud.C.PLANS).doc(id).get() }
function save(plan) { return cloud.callFunction('savePlan', plan) }
function remove(id) { return cloud.callFunction('deletePlan', { id: id }) }
function count() { return cloud.db().collection(cloud.C.PLANS).count() }

module.exports = { list, get, save, remove, count }
