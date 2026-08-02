// 云函数：灌入测试数据（8 周三分化训练生涯）
// 用法：微信开发者工具 → 云开发控制台 → 云函数 → 部署 seedData → 「测试」运行一次
//       控制台直接「测试」不会注入微信上下文（getWXContext().OPENID 为空），
//       此时自动降级为固定测试 openid（seed-test-openid），照样能灌数据。
// 幂等：重复运行会先删除本 openid 的 isSeed:true 数据再重建，不会与真实数据混淆。
// 注意：云函数端写入不会自动补 _openid，必须手动写入，否则小程序端（免登录模式按 _openid 过滤）读不到。
const cloud = require('wx-server-sdk')
const { genSeed } = require('./genData')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const SEED_FLAG = { isSeed: true }
const FALLBACK_OPENID = 'seed-test-openid' // 控制台测试（无微信上下文）时使用的降级 openid

// 分批写入，避免并发超限
async function batchAdd(name, items) {
  const BATCH = 10
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH)
    await Promise.all(slice.map((doc) => db.collection(name).add({ data: doc })))
  }
}

async function clearSeeds(name, openid) {
  // 删除旧 seed（云函数端支持 where().remove()）
  await db.collection(name).where(Object.assign({ _openid: openid }, SEED_FLAG)).remove()
}

exports.main = async (event) => {
  // 优先级：微信调用上下文 OPENID > 手动传入 event.openid > 控制台测试降级 openid
  const { OPENID } = cloud.getWXContext()
  const openid = OPENID || (event && event.openid) || FALLBACK_OPENID

  const data = genSeed({})
  const withOwner = (doc) => Object.assign({ _openid: openid }, doc)

  // 1) 用户档案（幂等：有则跳过）
  const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (!userRes.data.length) {
    await db.collection('users').add({
      data: withOwner(Object.assign({
        nickName: '测试用户',
        goal: '增肌 · 三分化',
        level: '进阶',
        createdAt: new Date()
      }, SEED_FLAG))
    })
  }

  // 2) 清旧 seed（四个数据集合）
  await Promise.all(['workouts', 'sets', 'plans', 'bodyMetrics'].map((n) => clearSeeds(n, openid)))

  // 3) workouts：先插入拿 _id，再映射 sets.sessionId
  const idMap = {}
  for (const w of data.workouts) {
    const res = await db.collection('workouts').add({
      data: withOwner(Object.assign({
        date: new Date(w.date),
        dateStr: w.dateStr,
        title: w.title,
        planId: '',
        exercises: w.exercises,
        setTotal: w.setTotal,
        createdAt: new Date()
      }, SEED_FLAG))
    })
    idMap[w._key] = res._id
  }

  // 4) sets（把 _w 替换为真实 sessionId）
  const setDocs = data.sets.map((s) => withOwner(Object.assign({
    sessionId: idMap[s._w],
    exerciseId: s.exerciseId,
    exerciseName: s.exerciseName,
    setIndex: s.setIndex,
    reps: s.reps,
    weight: s.weight,
    restSec: s.restSec,
    completed: true,
    createdAt: new Date()
  }, SEED_FLAG)))
  await batchAdd('sets', setDocs)

  // 5) plans
  await batchAdd('plans', data.plans.map((p) => withOwner(Object.assign({
    name: p.name,
    items: p.items,
    createdAt: new Date()
  }, SEED_FLAG))))

  // 6) bodyMetrics
  await batchAdd('bodyMetrics', data.bodyMetrics.map((b) => withOwner(Object.assign({
    dateStr: b.dateStr,
    weight: b.weight,
    fatPct: b.fatPct,
    height: b.height,
    chest: b.chest,
    waist: b.waist,
    arm: b.arm,
    thigh: b.thigh,
    createdAt: new Date()
  }, SEED_FLAG))))

  return {
    ok: true,
    openid: openid,
    fromFallback: !OPENID && !(event && event.openid),
    summary: {
      workouts: data.workouts.length,
      sets: data.sets.length,
      plans: data.plans.length,
      bodyMetrics: data.bodyMetrics.length
    },
    tip: openid === FALLBACK_OPENID
      ? '控制台测试模式（降级 openid）。若要在小程序内看到数据，请从小程序端调用本函数，或在小程序内正常使用后数据归属真实 openid。'
      : '已按 isSeed 标记写入，重复运行会先清后建'
  }
}
