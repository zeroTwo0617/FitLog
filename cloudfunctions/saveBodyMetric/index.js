const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const RANGES = { height: [50, 250], weight: [20, 400], fatPct: [1, 80], chest: [20, 300], waist: [20, 300], arm: [5, 150], thigh: [10, 200] }
function fail(code, message) { return { ok: false, code: code, message: message } }

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
function normalize(value, range) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= range[0] && n <= range[1] ? n : undefined
}
exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  if (!isDateStr(event && event.dateStr)) return fail('INVALID_DATE', '身体数据日期无效或晚于今天')
  const data = { dateStr: String(event.dateStr), date: new Date(String(event.dateStr)) }
  Object.keys(RANGES).forEach((key) => { data[key] = normalize(event[key], RANGES[key]) })
  if (Object.keys(RANGES).some((key) => data[key] === undefined)) return fail('INVALID_BODY_METRIC', '身体数据超出合理范围')
  if (!Object.keys(RANGES).some((key) => data[key] != null)) return fail('INVALID_BODY_METRIC', '至少填写一项身体数据')
  data.note = String(event.note || '').slice(0, 240)
  try {
    // 每天一条：同一天重复保存覆盖当天记录，事务保证并发下不会产生两条同日记录。
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await db.runTransaction(async (transaction) => {
          const existing = await transaction.collection('bodyMetrics').where({ dateStr: data.dateStr, _openid: openid }).get()
          const row = existing && existing.data && existing.data[0]
          const now = new Date()
          if (row) {
            await transaction.collection('bodyMetrics').doc(row._id).update({ data: Object.assign({}, data, { updatedAt: now }) })
            return { id: row._id, created: false }
          }
          const added = await transaction.collection('bodyMetrics').add({ data: Object.assign({}, data, { _openid: openid, createdAt: now }) })
          return { id: added._id, created: true }
        })
        return { ok: true, id: result.id, created: result.created }
      } catch (error) {
        // 写冲突（并发保存同一天）时重试
        if (attempt >= 2) throw error
      }
    }
    throw new Error('身体数据并发保存多次冲突')
  } catch (error) {
    console.error('saveBodyMetric failed', error)
    return fail('SAVE_BODY_FAILED', '身体数据保存失败')
  }
}
