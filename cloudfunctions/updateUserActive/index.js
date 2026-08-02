const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async function () {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录微信云开发' }
  try {
    await db.collection('users').where({ _openid: openid }).update({ data: { lastActiveAt: new Date() } })
    return { ok: true }
  } catch (error) {
    console.error('updateUserActive failed', error)
    return { ok: false, code: 'UPDATE_USER_FAILED', message: '用户状态更新失败' }
  }
}
