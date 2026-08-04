const cloud = require('../cloud.js')

function listAll() {
  if (typeof cloud.getAll === 'function') return cloud.getAll(cloud.C.WORKOUTS, 100)
  return cloud.db().collection(cloud.C.WORKOUTS).limit(1000).get().then((res) => (res && res.data) || [])
}
function listRecent(limit) {
  return cloud.db().collection(cloud.C.WORKOUTS).orderBy('dateStr', 'desc').limit(limit || 30).get()
    .then((res) => (res && res.data) || [])
}
function count() { return cloud.db().collection(cloud.C.WORKOUTS).count() }
function get(id) { return cloud.db().collection(cloud.C.WORKOUTS).doc(id).get() }
function sets(sessionId) {
  return cloud.db().collection(cloud.C.SETS).where({ sessionId: sessionId }).get()
    .then((res) => (res && res.data) || [])
}
function listSetsAll() {
  if (typeof cloud.getAll === 'function') return cloud.getAll(cloud.C.SETS, 100)
  return cloud.db().collection(cloud.C.SETS).limit(1000).get().then((res) => (res && res.data) || [])
}
function save(payload) { return cloud.callFunction('saveWorkout', payload) }

// 一次取某天全部训练 + 全部组明细（云函数聚合，避免逐条查 sets 的 N+1）
function dayDetail(dateStr) { return cloud.callFunction('getDayDetail', { dateStr: dateStr }) }

module.exports = { listAll, listRecent, count, get, sets, listSetsAll, save, dayDetail }
