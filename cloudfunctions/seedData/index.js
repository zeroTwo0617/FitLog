// 云函数：灌入测试数据（8 周三分化训练生涯）
// 用法：微信开发者工具 → 云开发控制台 → 云函数 → 部署 seedData → 在小程序「我的」页点「载入测试数据」
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

// 确保集合存在（云函数 SDK 支持时创建，不支持则依赖写入自动建表）
async function ensureCollection(name) {
  if (typeof db.createCollection === 'function') {
    try { await db.createCollection(name) } catch (e) { /* 已存在则忽略 */ }
  }
}

// 写入重试：云数据库有写入 QPS 限制，并发突发时偶发限流，退避重试即可
// 集合尚未创建（fresh 环境）时，先尝试创建再写入
async function addRetry(name, doc, attempt = 0) {
  try {
    return await db.collection(name).add({ data: doc })
  } catch (e) {
    const msg = (e && e.errMsg) || ''
    if (/not exists|does not exist|502005/i.test(msg)) {
      await ensureCollection(name)
      return db.collection(name).add({ data: doc })
    }
    if (/limit|concurrent|exceed|rate|too many/i.test(msg) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
      return addRetry(name, doc, attempt + 1)
    }
    throw e
  }
}

// 分批并发写入，返回每条写入后的 _id（按入参顺序）
async function batchAddReturning(name, items) {
  const BATCH = 10
  const ids = []
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH)
    const res = await Promise.all(slice.map((doc) => addRetry(name, doc)))
    res.forEach((r) => ids.push(r && r._id))
  }
  return ids
}

// 清空本 openid 的旧 seed；集合尚未创建时忽略（视为无数据可清）
async function clearSeeds(name, openid) {
  try {
    await db.collection(name).where(Object.assign({ _openid: openid }, SEED_FLAG)).remove()
  } catch (e) {
    const msg = (e && e.errMsg) || ''
    if (!/not exists|does not exist|502005/i.test(msg)) throw e
  }
}

exports.main = async (event) => {
  try {
    // 优先级：微信调用上下文 OPENID > 手动传入 event.openid > 控制台测试降级 openid
    const { OPENID } = cloud.getWXContext()
    const openid = OPENID || (event && event.openid) || FALLBACK_OPENID

    const data = genSeed({ chartDemo: event && event.mode === 'chart' })
    const withOwner = (doc) => Object.assign({ _openid: openid }, doc)

    // 1) 用户档案（幂等：有则跳过）
    let userExists = false
    try {
      const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
      userExists = !!(userRes.data && userRes.data.length)
    } catch (e) {
      // users 集合不存在：下方会创建，忽略
    }
    if (!userExists) {
      await addRetry('users', withOwner(Object.assign({
        nickName: '测试用户',
        goal: '增肌 · 三分化',
        level: '进阶',
        createdAt: new Date()
      }, SEED_FLAG)))
    }

    // 2) 清旧 seed（四个数据集合）；集合不存在时自动忽略
    await Promise.all(['workouts', 'sets', 'plans', 'bodyMetrics'].map((n) => clearSeeds(n, openid)))

    // 3) workouts：分批并发写入，拿回 _id 用于映射 sets.sessionId
    const workoutDocs = data.workouts.map((w) => withOwner(Object.assign({
      date: new Date(w.date),
      dateStr: w.dateStr,
      title: w.title,
      planId: '',
      exercises: w.exercises,
      setTotal: w.setTotal,
      createdAt: new Date()
    }, SEED_FLAG)))
    const workoutIds = await batchAddReturning('workouts', workoutDocs)
    const idMap = {}
    data.workouts.forEach((w, i) => { idMap[w._key] = workoutIds[i] })

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
    await batchAddReturning('sets', setDocs)

    // 5) plans
    await batchAddReturning('plans', data.plans.map((p) => withOwner(Object.assign({
      name: p.name,
      items: p.items,
      createdAt: new Date()
    }, SEED_FLAG))))

    // 6) bodyMetrics
    await batchAddReturning('bodyMetrics', data.bodyMetrics.map((b) => withOwner(Object.assign({
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
        ? '控制台测试模式（降级 openid）。若要在小程序内看到数据，请从小程序端调用本函数。'
        : '已按 isSeed 标记写入，重复运行会先清后建'
    }
  } catch (e) {
    const msg = (e && (e.message || e.errMsg)) || '未知错误'
    console.error('seedData 执行失败：', e)
    return { ok: false, error: msg }
  }
}
