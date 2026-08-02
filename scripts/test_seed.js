// Seed 数据生成自测：结构 / 引用一致性 / 渐进负荷（保证灌库后各页图表有像样的趋势）
const path = require('path')
const { genSeed } = require(path.resolve(__dirname, '..', 'cloudfunctions', 'seedData', 'genData.js'))

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg) }
  else { fail++; console.log('  ✗ ' + msg) }
}

// 固定基准时间，保证可复现（2026-07-10 是周五，本周一/三/五均为过去或当天）
const data = genSeed({ now: '2026-07-10T04:00:00.000Z' })

// ---- 总量与日期 ----
ok(data.workouts.length === 24, '8 周 × 每周 3 练 = 24 次训练，实际 ' + data.workouts.length)
ok(data.sets.length >= 250, '组明细 ≥ 250 条（每动作 3-4 组），实际 ' + data.sets.length)
ok(data.plans.length === 3, '训练计划 3 个')
ok(data.bodyMetrics.length === 8, '身体数据 8 周')

// ---- workouts：日期合法且按周递增 ----
const sorted = data.workouts.slice().sort((a, b) => (a.dateStr < b.dateStr ? -1 : 1))
ok(sorted[0].dateStr <= sorted[23].dateStr, '训练日期升序')
ok(sorted.every((w) => w.dateStr <= '2026-07-10'), '无未来日期')
const titles = new Set(data.workouts.map((w) => w.title))
ok(titles.has('练胸日') && titles.has('练腿日') && titles.has('练背日'), '三分化标题齐全')
ok(sorted.every((w) => w.setTotal === w.exercises.reduce((s, e) => s + e.setCount, 0)), 'workout.setTotal 与 exercises 概要一致')

// ---- sets：引用与连续性 ----
const wKeys = new Set(data.workouts.map((w) => w._key))
ok(data.sets.every((s) => wKeys.has(s._w)), '每条 sets 都能找到所属 workout')
// setIndex 按「动作内」从 1 起连续（不同动作各自编号，这是数据模型语义）
const byEx = {}
data.sets.forEach((s) => { const k = s._w + '|' + s.exerciseId; (byEx[k] = byEx[k] || []).push(s) })
ok(Object.keys(byEx).every((k) => {
  const arr = byEx[k].slice().sort((a, b) => a.setIndex - b.setIndex)
  return arr.every((s, i) => s.setIndex === i + 1)
}), '每个动作的 setIndex 从 1 起连续')
ok(data.sets.every((s) => s.reps > 0 && s.weight >= 0 && s.completed === true), 'reps>0 / weight≥0 / 全部已完成')

// ---- 渐进负荷：深蹲首次出现 vs 最后一次出现（1RM 趋势有涨头） ----
const dateOf = {}
data.workouts.forEach((w) => { dateOf[w._key] = w.dateStr })
const squatSets = data.sets.filter((s) => s.exerciseId === 'seed-squat')
const squatDates = squatSets.map((s) => dateOf[s._w]).sort()
const firstSquatW = Math.max.apply(null, squatSets.filter((s) => dateOf[s._w] === squatDates[0]).map((s) => s.weight))
const lastSquatW = Math.max.apply(null, squatSets.filter((s) => dateOf[s._w] === squatDates[squatDates.length - 1]).map((s) => s.weight))
ok(lastSquatW > firstSquatW, `深蹲重量渐进：最早 ${firstSquatW}kg → 最近 ${lastSquatW}kg`)

// ---- 身体数据：按时间轴体重递增（8 周前轻 → 现在重）/ BMI 可推导 ----
const bodyByDate = data.bodyMetrics.slice().sort((a, b) => (a.dateStr < b.dateStr ? -1 : 1))
const bws = bodyByDate.map((b) => b.weight)
ok(bws[0] < bws[bws.length - 1], `体重随时间增长：${bws[0]} → ${bws[bws.length - 1]}`)
ok(data.bodyMetrics.every((b) => b.height === 175 && b.waist < b.chest && b.arm < b.thigh), '身高/围度数值合理')

// ---- plans：结构与目标字段 ----
ok(data.plans.every((p) => p.name && p.items.length >= 3), '计划有名称且 ≥3 动作')
ok(data.plans.every((p) => p.items.every((it) => it.exerciseId && it.exerciseName && it.targetSets > 0 && it.targetReps > 0)), '计划条目含目标组数/次数/重量')

console.log('\n========================================')
console.log(`  Seed 生成自测：${pass} 通过 / ${fail} 失败`)
console.log('========================================')
process.exit(fail ? 1 : 0)
