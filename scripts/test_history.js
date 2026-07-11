// 功能 #4 自测：纯函数单测 + mock 云读取验证 history / history-detail 读取与整理逻辑。
// 运行：node scripts/test_history.js
const path = require('path')
const assert = require('assert')

// ===== 1) 纯函数单测（无需 wx）=====
const hd = require(path.join(__dirname, '..', 'utils', 'historyData.js'))

const wA = { _id: 'a', date: '2026-07-10T10:00:00Z', exercises: [{ exerciseId: 'e1', name: '动作一', nameEn: 'x', setCount: 2 }] }
const wB = { _id: 'b', date: '2026-07-12T10:00:00Z', exercises: [{ exerciseId: 'e2', name: '动作二', nameEn: 'y', setCount: 1 }] }
const sorted = hd.sortWorkouts([wA, wB])
assert.strictEqual(sorted[0]._id, 'b', 'sortWorkouts 应倒序（新在前）')

const workout = { exercises: [{ exerciseId: 'e1', name: '动作一', nameEn: 'x', setCount: 0 }] }
const sets = [
  { exerciseId: 'e1', exerciseName: '动作一', setIndex: 2, reps: 10, weight: 50, restSec: null },
  { exerciseId: 'e1', exerciseName: '动作一', setIndex: 1, reps: 12, weight: 0, restSec: 60 }
]
const groups = hd.buildGroups(workout, sets)
assert.strictEqual(groups.length, 1, 'buildGroups 应 1 组')
assert.strictEqual(groups[0].sets.length, 2, '组内应为 2 组')
assert.strictEqual(groups[0].sets[0].setIndex, 1, '组内应按 setIndex 升序')
console.log('✅ 纯函数单测通过（sortWorkouts / buildGroups）')

// ===== 2) mock 云 + Page，验证页面读取 =====
let pageOpts = null
global.Page = (opts) => { pageOpts = opts }

const MOCK = {
  workouts: [
    { _id: 'w1', dateStr: '2026-07-10', date: '2026-07-10T10:00:00Z', setTotal: 3, exercises: [{ exerciseId: '0001', name: '仰卧起坐', nameEn: 'a', setCount: 3 }] },
    { _id: 'w2', dateStr: '2026-07-12', date: '2026-07-12T10:00:00Z', setTotal: 2, exercises: [{ exerciseId: '0002', name: '侧腰屈', nameEn: 'b', setCount: 2 }, { exerciseId: '0003', name: '空中自行车', nameEn: 'c', setCount: 0 }] }
  ],
  sets: [
    { sessionId: 'w1', exerciseId: '0001', exerciseName: '仰卧起坐', setIndex: 1, reps: 12, weight: 60, restSec: 90 },
    { sessionId: 'w1', exerciseId: '0001', exerciseName: '仰卧起坐', setIndex: 2, reps: 10, weight: 62.5, restSec: null },
    { sessionId: 'w1', exerciseId: '0001', exerciseName: '仰卧起坐', setIndex: 3, reps: 8, weight: 0, restSec: 60 },
    { sessionId: 'w2', exerciseId: '0002', exerciseName: '侧腰屈', setIndex: 1, reps: 15, weight: null, restSec: null }
  ]
}

function makeCollection(name) {
  const col = {
    _name: name,
    _where: null,
    limit() { return col },
    orderBy() { return col },
    where(w) { col._where = w; return col },
    get() {
      if (name === 'workouts') return Promise.resolve({ data: MOCK.workouts })
      if (name === 'sets') {
        const w = col._where && col._where.sessionId
        return Promise.resolve({ data: MOCK.sets.filter(s => !w || s.sessionId === w) })
      }
      return Promise.resolve({ data: [] })
    },
    doc(id) {
      const data = MOCK.workouts.find(x => x._id === id) || null
      return { get: () => Promise.resolve({ data }) }
    },
    add() { return Promise.resolve({ _id: 'x' }) }
  }
  return col
}
global.wx = {
  cloud: { database: () => ({ collection: makeCollection }) },
  navigateTo: () => {},
  showToast: () => {}
}

function makeInstance(opts) {
  const inst = Object.assign({}, opts)
  inst.data = JSON.parse(JSON.stringify(opts.data))
  inst.setData = function (patch, cb) {
    for (const k in patch) {
      if (k.indexOf('.') >= 0) {
        const parts = k.split('.')
        let o = inst.data
        for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]
        o[parts[parts.length - 1]] = patch[k]
      } else inst.data[k] = patch[k]
    }
    if (cb) cb()
  }
  return inst
}

// 2a) history 列表
require(path.join(__dirname, '..', 'pages', 'history', 'history.js'))
let inst = makeInstance(pageOpts)
inst.onShow()
setTimeout(() => {
  assert.strictEqual(inst.data.list[0]._id, 'w2', 'history 列表应倒序，w2(07-12)在前')
  assert.strictEqual(inst.data.list[0].namesText, '侧腰屈、空中自行车', 'namesText 应拼接动作名')
  assert.strictEqual(inst.data.loading, false, 'loading 应结束')
  console.log('✅ history 列表读取 + 整理通过')

  // 2b) history-detail 详情
  require(path.join(__dirname, '..', 'pages', 'history-detail', 'history-detail.js'))
  const inst2 = makeInstance(pageOpts)
  inst2.onLoad({ id: 'w1' })
  setTimeout(() => {
    const g = inst2.data.groups
    assert.strictEqual(g.length, 1, 'detail 应 1 个动作分组')
    assert.strictEqual(g[0].sets.length, 3, 'detail 组内 3 组')
    assert.strictEqual(g[0].sets[0].repsText, '12', 'repsText=12')
    assert.strictEqual(g[0].sets[1].weightText, '62.5 kg', 'weightText=62.5 kg')
    assert.strictEqual(g[0].sets[2].weightText, '自重', 'weight=0 → 自重')
    assert.strictEqual(g[0].sets[1].restText, '—', 'restSec=null → —')
    console.log('✅ history-detail 详情读取 + 格式化通过')
    console.log('🎉 功能 #4 自测全部通过')
  }, 80)
}, 80)
