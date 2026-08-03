const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function fail(code, message) { return { ok: false, code: code, message: message } }
function num(value, min, max, integer) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return null
  return n
}
function normalize(event) {
  const name = String(event && event.name || '').trim().slice(0, 80)
  const source = event && event.items
  if (!name || !Array.isArray(source) || source.length < 1 || source.length > 30) return null
  const items = source.map((item) => {
    const targetSets = num(item && item.targetSets, 1, 20, true)
    const targetReps = num(item && item.targetReps, 1, 100, true)
    const targetWeight = num(item && item.targetWeight, 0, 1000, false)
    if (!item || !item.exerciseId || !item.exerciseName || targetSets == null ||
      (item.targetReps !== '' && item.targetReps != null && targetReps == null) ||
      (item.targetWeight !== '' && item.targetWeight != null && targetWeight == null)) return null
    return { exerciseId: String(item.exerciseId).slice(0, 80), exerciseName: String(item.exerciseName).slice(0, 100), targetSets: targetSets, targetReps: targetReps, targetWeight: targetWeight }
  })
  return items.every(Boolean) ? { name: name, items: items } : null
}
exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  const normalized = normalize(event || {})
  if (!normalized) return fail('INVALID_PLAN', '训练计划字段无效')
  const now = new Date()
  const data = Object.assign({}, normalized, { updatedAt: now })
  try {
    if (event.id) {
      const res = await db.collection('plans').where({ _id: String(event.id), _openid: openid }).update({ data: data })
      const updated = res && res.stats && res.stats.updated
      if (!updated) return fail('NOT_FOUND', '训练计划不存在或无权修改')
      return { ok: true, id: String(event.id), created: false }
    }
    const result = await db.collection('plans').add({ data: Object.assign({}, data, { _openid: openid, createdAt: now }) })
    return { ok: true, id: result._id, created: true }
  } catch (error) {
    console.error('savePlan failed', error)
    return fail('SAVE_PLAN_FAILED', '计划保存失败')
  }
}
