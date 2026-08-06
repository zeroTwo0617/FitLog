const cloud = require('../cloud.js')
const { applyOrder } = require('../queryOrder.js')

const BODY_ORDER = [
  { field: 'dateStr', direction: 'desc' },
  { field: 'updatedAt', direction: 'desc' },
  { field: 'createdAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]

function listAll() { return cloud.getAll(cloud.C.BODY, 100, BODY_ORDER) }
function latest() {
  const query = applyOrder(cloud.db().collection(cloud.C.BODY), BODY_ORDER)
  return query.limit(1).get()
    .then((res) => (res && res.data) || [])
}
function save(data) { return cloud.callFunction('saveBodyMetric', data) }

module.exports = { listAll, latest, save }
