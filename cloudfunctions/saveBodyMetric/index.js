const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const RANGES = { height: [50, 250], weight: [20, 400], fatPct: [1, 80], chest: [20, 300], waist: [20, 300], arm: [5, 150], thigh: [10, 200] }
function fail(code, message) { return { ok: false, code: code, message: message } }
function normalize(value, range) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= range[0] && n <= range[1] ? n : undefined
}
exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(event && event.dateStr || ''))) return fail('INVALID_DATE', '身体数据日期无效')
  const data = { dateStr: String(event.dateStr), date: new Date(String(event.dateStr)) }
  Object.keys(RANGES).forEach((key) => { data[key] = normalize(event[key], RANGES[key]) })
  if (Object.keys(RANGES).some((key) => data[key] === undefined)) return fail('INVALID_BODY_METRIC', '身体数据超出合理范围')
  if (!Object.keys(RANGES).some((key) => data[key] != null)) return fail('INVALID_BODY_METRIC', '至少填写一项身体数据')
  data.note = String(event.note || '').slice(0, 240)
  data.createdAt = new Date()
  try {
    const result = await db.collection('bodyMetrics').add({ data: Object.assign({}, data, { _openid: openid }) })
    return { ok: true, id: result._id }
  } catch (error) {
    console.error('saveBodyMetric failed', error)
    return fail('SAVE_BODY_FAILED', '身体数据保存失败')
  }
}
