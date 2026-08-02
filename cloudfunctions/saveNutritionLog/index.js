const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
function fail(code, message) { return { ok: false, code: code, message: message } }
function number(value, max) { const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null }
function normalize(event) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(event.dateStr || ''))) return null
  if (TYPES.indexOf(event.mealType) < 0) return null
  const values = { calories: number(event.calories, 10000), protein: number(event.protein, 2000), carbs: number(event.carbs, 3000), fat: number(event.fat, 1000) }
  if (Object.keys(values).some((key) => values[key] == null)) return null
  return Object.assign({}, event, values, { dateStr: String(event.dateStr), mealType: event.mealType, note: String(event.note || '').slice(0, 240), source: ['manual', 'photo', 'agent'].indexOf(event.source) >= 0 ? event.source : 'manual' })
}
exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  const normalized = normalize(event || {})
  if (!normalized) return fail('INVALID_NUTRITION', '饮食数据字段无效')
  const now = new Date()
  const data = Object.assign({}, normalized, { updatedAt: now })
  delete data._openid; delete data._id; delete data.createdAt
  try {
    if (event.id) {
      await db.collection('nutritionLogs').where({ _id: String(event.id), _openid: openid }).update({ data: data })
      return { ok: true, id: String(event.id), created: false }
    }
    const result = await db.collection('nutritionLogs').add({ data: Object.assign({}, data, { _openid: openid, createdAt: now }) })
    return { ok: true, id: result._id, created: true }
  } catch (error) {
    console.error('saveNutritionLog failed', error)
    return fail('SAVE_NUTRITION_FAILED', '饮食记录保存失败')
  }
}
