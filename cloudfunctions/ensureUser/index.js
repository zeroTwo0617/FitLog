const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function isMissingDocument(error) {
  const message = String(error && (error.errMsg || error.message || '')).toLowerCase()
  const code = String(error && (error.errCode || error.code || '')).toLowerCase()
  return code.indexOf('document_not_exist') >= 0 || code.indexOf('document_not_found') >= 0 ||
    message.indexOf('document does not exist') >= 0 || message.indexOf('document not exist') >= 0
}

exports.main = async function () {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录微信云开发' }

  try {
    const users = db.collection('users')
    const existing = await users.where({ _openid: openid }).limit(1).get()
    if (existing.data && existing.data[0]) return { ok: true, profile: existing.data[0], created: false }

    // 先按确定性文档 ID 再读一次，处理查询延迟或并发请求已经创建档案的情况。
    const ref = users.doc(openid)
    let deterministic
    try {
      deterministic = await ref.get()
    } catch (error) {
      if (!isMissingDocument(error)) throw error
    }
    if (deterministic && deterministic.data) return { ok: true, profile: deterministic.data, created: false }

    const now = new Date()
    // merge 保留可能已存在的昵称、目标等档案字段，重复请求只会写同一个文档。
    await ref.set({
      data: {
        _openid: openid,
        source: 'miniprogram',
        createdAt: now,
        lastActiveAt: now
      },
      merge: true
    })
    const created = await ref.get()
    return { ok: true, profile: created.data || null, created: true }
  } catch (error) {
    console.error('ensureUser failed', error)
    return { ok: false, code: 'ENSURE_USER_FAILED', message: '用户档案初始化失败，请稍后重试' }
  }
}
