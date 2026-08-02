// 云函数：导出当前用户全部数据（workouts / sets / plans / bodyMetrics → JSON）
// 部署：微信开发者工具 → 云开发控制台 → 云函数 → 上传部署 exportData
// 权限：云函数以管理员身份运行，必须显式按 _openid 过滤，保证只导自己的数据
const cloud = require('wx-server-sdk')
const { buildPayload } = require('./buildPayload')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const PAGE = 100 // 单次读取上限，超过则分页

async function fetchAll(name, openid) {
  const col = db.collection(name)
  const where = { _openid: openid }
  const countRes = await col.where(where).count()
  const total = countRes.total || 0
  const batchCount = Math.ceil(total / PAGE)
  const items = []
  for (let i = 0; i < batchCount; i++) {
    const res = await col.where(where).skip(i * PAGE).limit(PAGE).get()
    items.push(...res.data)
  }
  return items
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { error: 'NO_OPENID' }
  }
  const [workouts, sets, plans, bodyMetrics] = await Promise.all([
    fetchAll('workouts', OPENID),
    fetchAll('sets', OPENID),
    fetchAll('plans', OPENID),
    fetchAll('bodyMetrics', OPENID)
  ])
  return buildPayload({ workouts, sets, plans, bodyMetrics })
}
