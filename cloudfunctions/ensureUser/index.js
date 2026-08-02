const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async function () {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录微信云开发' }

  const existing = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (existing.data && existing.data[0]) return { ok: true, profile: existing.data[0], created: false }

  // 以 openid 作为文档 ID，重复请求会覆盖同一份档案，不会产生重复用户。
  await db.collection('users').doc(openid).set({
    data: {
      _openid: openid,
      source: 'miniprogram',
      createdAt: new Date(),
      lastActiveAt: new Date()
    }
  })
  const created = await db.collection('users').doc(openid).get()
  return { ok: true, profile: created.data || null, created: true }
}
