const cloud = require('../cloud.js')
const { applyOrder } = require('../queryOrder.js')

const WORKOUT_ORDER = [
  { field: 'dateStr', direction: 'desc' },
  { field: 'date', direction: 'desc' },
  { field: 'createdAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]
const SET_ORDER = [
  { field: 'setIndex', direction: 'asc' },
  { field: 'createdAt', direction: 'asc' },
  { field: '_id', direction: 'asc' }
]
const SETS_ALL_ORDER = [
  { field: 'createdAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]

function listAll() {
  if (typeof cloud.getAll === 'function') return cloud.getAll(cloud.C.WORKOUTS, 100, WORKOUT_ORDER)
  return applyOrder(cloud.db().collection(cloud.C.WORKOUTS), WORKOUT_ORDER).limit(20).get().then((res) => (res && res.data) || [])
}
function listRecent(limit) {
  const requested = Number(limit)
  const bounded = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 30
  if (bounded > 20) return cloud.getAll(cloud.C.WORKOUTS, 20, WORKOUT_ORDER).then((rows) => rows.slice(0, bounded))
  return applyOrder(cloud.db().collection(cloud.C.WORKOUTS), WORKOUT_ORDER).limit(bounded).get()
    .then((res) => (res && res.data) || [])
}
function count() { return cloud.db().collection(cloud.C.WORKOUTS).count() }
function get(id) { return cloud.db().collection(cloud.C.WORKOUTS).doc(id).get() }
function sets(sessionId) {
  return cloud.getAll(cloud.C.SETS, 20, SET_ORDER, { sessionId: sessionId })
}
function listSetsAll() {
  if (typeof cloud.getAll === 'function') return cloud.getAll(cloud.C.SETS, 100, SETS_ALL_ORDER)
  return applyOrder(cloud.db().collection(cloud.C.SETS), SETS_ALL_ORDER).limit(20).get().then((res) => (res && res.data) || [])
}
function createRequestId() {
  return 'fitlog-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function save(payload) {
  const data = Object.assign({}, payload || {})
  if (!data.requestId) data.requestId = createRequestId()
  return cloud.callFunction('saveWorkout', data)
}

function isFunctionNotFound(error) {
  const message = String(error && (error.errMsg || error.message || ''))
  return message.indexOf('FUNCTION_NOT_FOUND') >= 0 || message.indexOf('FunctionName parameter could not be found') >= 0
}

// 开发环境可能还没有部署 getDayDetail；仅在函数不存在时降级，其他错误继续抛出。
function dayDetailFallback(dateStr) {
  return listAll().then((rows) => {
    const workouts = (rows || []).filter((item) => String(item.dateStr || '') === String(dateStr || ''))
    return Promise.all(workouts.map((workout) => sets(workout._id))).then((setsByWorkout) => ({
      ok: true,
      fallback: true,
      workouts: workouts,
      sets: setsByWorkout.reduce((all, current) => all.concat(current || []), [])
    }))
  })
}

// 一次取某天全部训练 + 全部组明细（云函数聚合，避免逐条查 sets 的 N+1）。
// 云函数未部署时使用本地查询兜底，保证开发环境仍可查看当天详情。
function dayDetail(dateStr) {
  return cloud.callFunction('getDayDetail', { dateStr: dateStr }).catch((error) => {
    if (!isFunctionNotFound(error)) throw error
    return dayDetailFallback(dateStr)
  })
}

module.exports = { listAll, listRecent, count, get, sets, listSetsAll, save, createRequestId, dayDetail }
