const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'workouts',
  'sets',
  'plans',
  'bodyMetrics',
  'nutritionLogs',
  'dietPlans',
  'agentSessions',
  'users'
]

function fail(code, message) {
  return { ok: false, code, message }
}

exports.main = async function () {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return fail('AUTH_REQUIRED', '无法确认当前用户身份')

  const removed = {}
  try {
    for (const name of COLLECTIONS) {
      const result = await db.collection(name).where({ _openid: openid }).remove()
      removed[name] = result && result.stats ? (result.stats.removed || 0) : 0
    }
    return { ok: true, removed: removed }
  } catch (error) {
    console.error('deleteUserData failed', error)
    return fail('DELETE_USER_DATA_FAILED', '数据删除未完成，请稍后重试')
  }
}
