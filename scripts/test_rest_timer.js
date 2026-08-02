// #7-A 自测：restTimer 纯函数 + record 页计时流（start/skip/adjust/finish）
const path = require('path')
const rt = require(path.resolve(__dirname, '..', 'miniprogram', 'utils', 'restTimer.js'))

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg) }
  else { fail++; console.log('  ✗ ' + msg) }
}

// ============ 1) 纯函数 ============
ok(rt.DEFAULT_REST === 90 && rt.MAX_REST === 600, '默认休息 90s / 上限 600s')
const now = 1000000
ok(rt.remainSec(now + 90 * 1000, now) === 90, 'remainSec 整秒')
ok(rt.remainSec(now + 90 * 1000, now + 1) === 90, 'remainSec 向上取整（1ms 后仍 90）')
ok(rt.remainSec(now + 1000, now + 1500) === 0, 'remainSec 负值钳到 0')
ok(rt.elapsedPct(now + 90 * 1000, now, 90) === 0, 'elapsedPct 起点 0%')
ok(rt.elapsedPct(now + 90 * 1000, now + 45 * 1000, 90) === 50, 'elapsedPct 中点 50%')
ok(rt.elapsedPct(now + 90 * 1000, now + 90 * 1000, 90) === 100, 'elapsedPct 终点 100%')
ok(rt.elapsedPct(now + 90 * 1000, now + 999 * 1000, 90) === 100, 'elapsedPct 超时钳 100%')
ok(rt.fmtTime(90) === '1:30' && rt.fmtTime(60) === '1:00' && rt.fmtTime(75) === '1:15' && rt.fmtTime(45) === '45' && rt.fmtTime(0) === '0', 'fmtTime 格式（1:30 / 1:00 / 1:15 / 45 / 0）')

// ============ 2) record 页计时流（mock 运行时） ============
let pageOpts = null
global.Page = (opts) => { pageOpts = opts }
global.getApp = () => ({ globalData: { theme: 'dark' } })
global.wx = { vibrateShort: () => {}, showToast: () => {}, showModal: () => {} }

require(path.resolve(__dirname, '..', 'miniprogram', 'pages', 'record', 'record.js'))

const inst = Object.assign({}, pageOpts)
inst.data = JSON.parse(JSON.stringify(pageOpts.data))
inst.setData = function (patch, cb) {
  for (const k in patch) {
    if (k.indexOf('.') >= 0) {
      const parts = k.split('.')
      let o = inst.data
      for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]
      o[parts[parts.length - 1]] = patch[k]
    } else {
      inst.data[k] = patch[k]
    }
  }
  if (cb) cb()
}
// 覆盖计时器副作用：不真跑 setInterval
const origSetInterval = global.setInterval
global.setInterval = () => 1
global.clearInterval = () => {}

// 造一条带 3 组数据的动作
inst.data.session = [{
  exerciseId: 'x1', name: '杠铃深蹲', nameEn: 'Squat',
  sets: [
    { reps: '8', weight: '100', rest: '60', completed: false },
    { reps: '8', weight: '100', rest: '', completed: false },
    { reps: '6', weight: '105', rest: '120', completed: false }
  ]
}]

// 打勾第 1 组 → 启动计时（取 rest 60s）
inst.toggleSet({ currentTarget: { dataset: { idx: 0, sidx: 0 } } })
ok(inst.data.restRunning === true, '打勾后计时启动')
ok(inst.data.restTotal === 60 && inst.data.restRemainText === '1:00', '取该组 rest=60s（显示 1:00）')
ok(inst.data.restLabel.indexOf('杠铃深蹲') >= 0 && inst.data.restLabel.indexOf('第 1 组') >= 0, '标签含动作与组号')

// 未填 rest 的组 → 默认 90s
inst.toggleSet({ currentTarget: { dataset: { idx: 0, sidx: 1 } } })
ok(inst.data.restTotal === 90, '未填 rest 用默认 90s')

// +15 微调
inst.adjustRest({ currentTarget: { dataset: { delta: 15 } } })
ok(inst.data.restRemain === 105 && inst.data.restRemainText === '1:45', '+15s 后剩余 105 → 1:45')

// −15 回到 90
inst.adjustRest({ currentTarget: { dataset: { delta: -15 } } })
ok(inst.data.restRemain === 90, '−15s 回到 90')

// 跳过
inst.skipRest()
ok(inst.data.restRunning === false && inst.data.restDone === false, '跳过清空计时状态')

// 倒计时到 0 → finishRest（重放剩余 0 的滴答）
inst.data.restEndAt = Date.now() - 1
inst.data.restRunning = true
inst._tickRest()
ok(inst.data.restDone === true && inst.data.restRunning === false, '归零后进入 REST OVER')

// 取消打勾不触发计时
inst.data.restRunning = false
inst.toggleSet({ currentTarget: { dataset: { idx: 0, sidx: 0 } } })
ok(inst.data.restRunning === false, '取消打勾不启动计时')

global.setInterval = origSetInterval

console.log('\n========================================')
console.log(`  #7-A 计时器自测：${pass} 通过 / ${fail} 失败`)
console.log('========================================')
process.exit(fail ? 1 : 0)
