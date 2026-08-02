// 云函数：灌入测试数据（8 周三分化训练生涯）
// 用法：微信开发者工具 → 云开发控制台 → 云函数 → 部署 seedData → 「测试」运行一次
// 幂等：重复运行会先删除本 openid 的 isSeed:true 数据再重建，不会与真实数据混淆
const cloud = require('wx-server-sdk')
const { genSeed } = require('./genData')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const SEED_FLAG = { isSeed: true }

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

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { error: 'NO_OPENID' }

  const data = genSeed({})

  // 1) 用户档案（幂等：有则跳过）
  const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  if (!userRes.data.length) {
    await db.collection('users').add({
      data: Object.assign({
        nickName: '测试用户',
        goal: '增肌 · 三分化',
        level: '进阶',
        createdAt: new Date()
      }, SEED_FLAG)
    })
  }

  // 2) 清旧 seed（四个数据集合）
  await Promise.all(['workouts', 'sets', 'plans', 'bodyMetrics'].map((n) => clearSeeds(n, OPENID)))

  // 3) workouts：先插入拿 _id，再映射 sets.sessionId
  const idMap = {}
  for (const w of data.workouts) {
    const res = await db.collection('workouts').add({
      data: Object.assign({
        date: new Date(w.date),
        dateStr: w.dateStr,
        title: w.title,
        planId: '',
        exercises: w.exercises,
        setTotal: w.setTotal,
        createdAt: new Date()
      }, SEED_FLAG)
    })
    idMap[w._key] = res._id
  }

  // 4) sets（把 _w 替换为真实 sessionId）
  const setDocs = data.sets.map((s) => Object.assign({
    sessionId: idMap[s._w],
    exerciseId: s.exerciseId,
    exerciseName: s.exerciseName,
    setIndex: s.setIndex,
    reps: s.reps,
    weight: s.weight,
    restSec: s.restSec,
    completed: true,
    createdAt: new Date()
  }, SEED_FLAG))
  await batchAdd('sets', setDocs)

  // 5) plans
  await batchAdd('plans', data.plans.map((p) => Object.assign({
    name: p.name,
    items: p.items,
    createdAt: new Date()
  }, SEED_FLAG)))

  // 6) bodyMetrics
  await batchAdd('bodyMetrics', data.bodyMetrics.map((b) => Object.assign({
    dateStr: b.dateStr,
    weight: b.weight,
    fatPct: b.fatPct,
    height: b.height,
    chest: b.chest,
    waist: b.waist,
    arm: b.arm,
    thigh: b.thigh,
    createdAt: new Date()
  }, SEED_FLAG)))

  return {
    ok: true,
    summary: {
      workouts: data.workouts.length,
      sets: data.sets.length,
      plans: data.plans.length,
      bodyMetrics: data.bodyMetrics.length
    },
    tip: '已按 isSeed 标记写入，重复运行会先清后建'
  }
}
