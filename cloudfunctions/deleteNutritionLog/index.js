const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录微信云开发' }
  if (!event || !event.id) return { ok: false, code: 'INVALID_ID', message: '饮食记录 ID 无效' }
  try {
    const res = await db.collection('nutritionLogs').where({ _id: String(event.id), _openid: openid }).remove()
    const removed = res && res.stats && res.stats.removed
    if (!removed) return { ok: false, code: 'NOT_FOUND', message: '饮食记录不存在或无权删除' }
    return { ok: true, id: String(event.id) }
  } catch (error) {
    console.error('deleteNutritionLog failed', error)
    return { ok: false, code: 'DELETE_NUTRITION_FAILED', message: '饮食记录删除失败' }
  }
}
