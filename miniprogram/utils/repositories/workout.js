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

module.exports = { listAll, listRecent, count, get, sets, listSetsAll, save, dayDetail }
