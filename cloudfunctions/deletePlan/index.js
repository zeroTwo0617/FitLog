const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录微信云开发' }
  if (!event || !event.id) return { ok: false, code: 'INVALID_ID', message: '计划 ID 无效' }
  try {
    await db.collection('plans').where({ _id: String(event.id), _openid: openid }).remove()
    return { ok: true, id: String(event.id) }
  } catch (error) {
    console.error('deletePlan failed', error)
    return { ok: false, code: 'DELETE_PLAN_FAILED', message: '计划删除失败' }
  }
}
