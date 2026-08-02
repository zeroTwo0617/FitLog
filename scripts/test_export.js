// #7-B 自测：buildPayload 纯函数（导出载荷结构与摘要）
const path = require('path')
const { buildPayload } = require(path.resolve(__dirname, '..', 'cloudfunctions', 'exportData', 'buildPayload.js'))

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg) }
  else { fail++; console.log('  ✗ ' + msg) }
}

const payload = buildPayload({
  workouts: [{ _id: 'w1', dateStr: '2026-08-02' }, { _id: 'w2' }],
  sets: [{ sessionId: 'w1' }],
  plans: [{ _id: 'p1', name: '练腿日' }],
  bodyMetrics: [{ _id: 'b1', weight: 72 }]
})

ok(payload.app === 'FitLog' && payload.version === 1, '元信息 app/version 正确')
ok(typeof payload.exportedAt === 'string' && payload.exportedAt.length > 10, 'exportedAt 为 ISO 时间串')
ok(payload.summary.workouts === 2 && payload.summary.sets === 1 && payload.summary.plans === 1 && payload.summary.bodyMetrics === 1, 'summary 计数正确（2/1/1/1）')
ok(payload.workouts.length === 2 && payload.sets[0].sessionId === 'w1', '四集合原样保留')
ok(payload.plans[0].name === '练腿日' && payload.bodyMetrics[0].weight === 72, '字段完整性抽查')

// 空数据兜底
const empty = buildPayload({})
ok(empty.summary.workouts === 0 && empty.summary.sets === 0, '空数据 summary 全 0 不报错')

console.log('\n========================================')
console.log(`  #7-B 导出自测：${pass} 通过 / ${fail} 失败`)
console.log('========================================')
process.exit(fail ? 1 : 0)
