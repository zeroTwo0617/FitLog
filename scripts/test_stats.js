// 功能 #6 自测：statsData 纯函数 + mock 云验证 stats 页聚合 / body 页保存
const path = require('path')
const abs = (p) => path.resolve(__dirname, p)
const sd = require(abs('../utils/statsData.js'))

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg) }
  else { fail++; console.log('  ✗ ' + msg) }
}

// ============ 1) statsData 纯函数 ============
const workouts = [
  { _id: 'w1', dateStr: '2026-07-10' },
  { _id: 'w2', dateStr: '2026-07-12' }
]
const sets = [
  { sessionId: 'w1', exerciseId: 'a', exerciseName: '卧推', reps: 10, weight: 60 },
  { sessionId: 'w1', exerciseId: 'b', exerciseName: '深蹲', reps: 8, weight: 100 },
  { sessionId: 'w2', exerciseId: 'a', exerciseName: '卧推', reps: 12, weight: 62 }
]
const agg = sd.aggregate(workouts, sets)
ok(agg.totalWorkouts === 2, 'aggregate totalWorkouts=2')
ok(agg.totalVolume === 10 * 60 + 8 * 100 + 12 * 62, 'aggregate 总容量 = 600+800+744=2144')
ok(agg.trainedDates.length === 2, '打卡日 = 2 天')
ok(agg.maxByExercise[0].name === '深蹲' && agg.maxByExercise[0].max === 100, '最大重量 Top1 = 深蹲 100kg')
ok(agg.maxByExercise[1].name === '卧推' && agg.maxByExercise[1].max === 62, '最大重量 Top2 = 卧推 62kg')

const trend = sd.volumeTrend(agg, 14)
ok(trend.length === 14, 'volumeTrend 返回 14 天')
ok(trend.filter(t => t.trained).length === 2, '趋势中 2 天标记 trained')
ok(trend.every(t => t.heightPct >= 0 && t.heightPct <= 100), 'heightPct 在 0-100 区间')

const cal = sd.buildCalendar(2026, 7, ['2026-07-10', '2026-07-12', '2026-07-12'])
ok(cal.length >= 28 && cal.length <= 42, 'buildCalendar 网格天数合理(含前置空格)')
ok(cal.some(c => c.day === 10 && c.trained) && cal.some(c => c.day === 12 && c.trained), '日历标记 10/12 为打卡')
ok(cal.some(c => c.isToday), '日历含今天标记')

const bodyRecs = [
  { dateStr: '2026-07-01', weight: 72 },
  { dateStr: '2026-07-10', weight: 70 },
  { dateStr: '2026-07-20', weight: 68 }
]
const bt = sd.bodyTrend(bodyRecs, 'weight')
ok(bt.length === 3, 'bodyTrend 返回 3 条')
ok(bt[0].dateStr === '2026-07-01' && bt[bt.length - 1].dateStr === '2026-07-20', 'bodyTrend 按日期升序')
ok(bt[0].heightPct > bt[bt.length - 1].heightPct, '体重更高 → 柱更高(72>70>68 对应 100>60>20)')
ok(bt.every(t => t.heightPct >= 20 && t.heightPct <= 100), 'bodyTrend heightPct 落在 20-100')

// ============ 2) mock 云：stats 页加载聚合 ============
const MOCK_DB = {
  workouts: workouts.slice(),
  sets: sets.slice()
}
function makeCollection(name) {
  const store = MOCK_DB[name] || (MOCK_DB[name] = [])
  const obj = {
    limit() { return obj },
    get() { return Promise.resolve({ data: store.slice() }) },
    add({ data }) { const _id = name + '_' + store.length; store.push(Object.assign({ _id }, data)); return Promise.resolve({ _id }) },
    count() { return Promise.resolve({ total: store.length }) },
    doc(id) { return { get: () => Promise.resolve({ data: store.find(x => x._id === id) || null }) } }
  }
  return obj
}
global.wx = {
  cloud: { database: () => ({ collection: makeCollection }) },
  login: (o) => o.success && o.success({ code: 'test_code' }),
  getStorageSync: () => null,
  setStorageSync: () => {},
  showToast: () => {},
  navigateTo: () => {}
}
global.__lastPage = null
global.Page = (cfg) => { global.__lastPage = cfg }

require(abs('../pages/stats/stats.js'))
const statsInst = Object.assign({}, global.__lastPage)
statsInst.setData = function (obj) { Object.assign(this.data, obj) }

// ============ 3) mock 云：body 页保存 ============
MOCK_DB.bodyMetrics = []
global.__lastPage = null
require(abs('../pages/body/body.js'))
const bodyInst = Object.assign({}, global.__lastPage)
bodyInst.setData = function (obj) { Object.assign(this.data, obj) }

;(async () => {
  statsInst.onShow()
  await new Promise((r) => setTimeout(r, 60))

  ok(statsInst.data.totalWorkouts === 2, 'stats 页：totalWorkouts=2')
  ok(statsInst.data.totalVolume === 2144, 'stats 页：totalVolume=2144')
  ok(statsInst.data.trend.length === 14, 'stats 页：趋势 14 天')
  ok(statsInst.data.maxByExercise.length === 2, 'stats 页：Top 最大重量 2 项')
  ok(statsInst.data.calendar.length >= 28, 'stats 页：日历已生成')
  ok(statsInst.data.hasData === true, 'stats 页：hasData=true')

  // body 保存（含身高）
  bodyInst.setData({ height: '175', weight: '70', fatPct: '', chest: '95', waist: '80', arm: '', thigh: '' })
  await bodyInst.save()
  await new Promise((r) => setTimeout(r, 60))

  ok(MOCK_DB.bodyMetrics.length === 1, 'body 页：写入 1 条 bodyMetrics')
  ok(MOCK_DB.bodyMetrics[0].weight === 70 && MOCK_DB.bodyMetrics[0].height === 175 && MOCK_DB.bodyMetrics[0].chest === 95, 'body 页：身高/体重/围度 Number 化正确')
  ok(bodyInst.data.records.length === 1 && bodyInst.data.hasData === true, 'body 页：保存后历史加载 1 条')
  ok(bodyInst.data.records[0].bmi === (70 / (1.75 * 1.75)).toFixed(1), 'body 页：BMI 由身高+体重派生正确')

  console.log('\n========================================')
  console.log('  功能 #6 自测：' + pass + ' 通过 / ' + fail + ' 失败')
  console.log('========================================')
  process.exit(fail === 0 ? 0 : 1)
})()
