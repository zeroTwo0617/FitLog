const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
function fail(code, message) { return { ok: false, code: code, message: message } }
function number(value, max) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null
  const n = Number(typeof value === 'string' ? value.trim() : value)
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null
}

// 真实日期校验：格式 YYYY-MM-DD、月份/日期合法（含闰年归一化拦截）、不允许未来日期
function isDateStr(value) {
  const str = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const parts = str.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() <= today.getTime()
}

// 只允许写入白名单字段，不透传客户端附带的未知字段（含 _id/createdAt 等）
function normalize(event) {
  const src = event || {}
  const dateStr = String(src.dateStr || src.date || '').trim()
  if (!isDateStr(dateStr)) return { ok: false, code: 'INVALID_DATE', message: '饮食日期无效或不能晚于今天' }
  const mealType = String(src.mealType || '').trim()
  if (TYPES.indexOf(mealType) < 0) return { ok: false, code: 'INVALID_MEAL_TYPE', message: '餐次字段无效，请重新选择餐次' }
  const values = {
    calories: number(src.calories != null ? src.calories : src.totalCalories, 10000),
    protein: number(src.protein != null ? src.protein : src.totalProtein, 2000),
    carbs: number(src.carbs != null ? src.carbs : src.totalCarbs, 3000),
    fat: number(src.fat != null ? src.fat : src.totalFat, 1000)
  }
  if (Object.keys(values).some((key) => values[key] == null)) {
    return { ok: false, code: 'INVALID_NUTRITION_VALUES', message: '热量、蛋白质、碳水和脂肪必须是 0 或以上的有效数字' }
  }
  return {
    ok: true,
    data: {
      dateStr: dateStr,
      mealType: mealType,
      foods: Array.isArray(src.foods) ? src.foods.slice(0, 12).map((item) => ({
        name: String(item && item.name || '').slice(0, 80),
        portion: String(item && item.portion || '').slice(0, 80),
        calories: number(item && item.calories, 10000) || 0,
        protein: number(item && item.protein, 2000) || 0,
        carbs: number(item && item.carbs, 3000) || 0,
        fat: number(item && item.fat, 1000) || 0,
        confidence: Math.min(1, Math.max(0, Number(item && item.confidence) || 0))
      })) : [],
      calories: values.calories,
      protein: values.protein,
      carbs: values.carbs,
      fat: values.fat,
      source: ['manual', 'photo', 'agent'].indexOf(src.source) >= 0 ? src.source : 'manual',
      confidence: Math.min(1, Math.max(0, Number(src.confidence) || 0)),
      note: String(src.note || '').slice(0, 240)
    }
  }
}
exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  const normalized = normalize(event || {})
  if (!normalized.ok) return fail(normalized.code, normalized.message)
  const now = new Date()
  const data = Object.assign({}, normalized.data, { updatedAt: now })
  delete data._openid; delete data._id; delete data.createdAt
  try {
    if (event.id) {
      const res = await db.collection('nutritionLogs').where({ _id: String(event.id), _openid: openid }).update({ data: data })
      const updated = res && res.stats && res.stats.updated
      if (!updated) return fail('NOT_FOUND', '饮食记录不存在或无权修改')
      return { ok: true, id: String(event.id), created: false }
    }
    const result = await db.collection('nutritionLogs').add({ data: Object.assign({}, data, { _openid: openid, createdAt: now }) })
    return { ok: true, id: result._id, created: true }
  } catch (error) {
    console.error('saveNutritionLog failed', error)
    return fail('SAVE_NUTRITION_FAILED', '饮食记录保存失败')
  }
}
