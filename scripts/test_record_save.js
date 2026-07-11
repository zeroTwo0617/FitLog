// 功能 #3 自测：模拟微信运行时，验证 record 页 save 写入 workouts/sets 的逻辑。
// 运行：node scripts/test_record_save.js
const path = require('path')

// 1) 收集 Page(options)
let pageOpts = null
global.Page = (opts) => { pageOpts = opts }

// 2) 收集云写入（按集合名分桶，避免把 users 档案写入误计入 sets）
const writes = { workouts: [], sets: [], other: [] }
function makeCollection(name) {
  return {
    add({ data }) {
      if (name === 'workouts') {
        const _id = 'w_' + writes.workouts.length
        writes.workouts.push(Object.assign({ _id }, data))
        return Promise.resolve({ _id })
      }
      if (name === 'sets') {
        writes.sets.push(data)
        return Promise.resolve({ _id: 's_' + writes.sets.length })
      }
      writes.other.push({ collection: name, data })
      return Promise.resolve({ _id: 'o_' + writes.other.length })
    },
    get() { return Promise.resolve({ data: [] }) },
    doc() { return { update: () => Promise.resolve({}) } }
  }
}
global.wx = {
  cloud: { database: () => ({ collection: makeCollection }) },
  login: (o) => o.success({ code: 'test_code' }),
  getStorageSync: () => false,
  setStorageSync: () => {},
  showToast: () => {}
}

// 3) 加载页面模块（会执行 Page(options)）
require(path.join(__dirname, '..', 'pages', 'record', 'record.js'))

// 4) 构造实例并模拟 setData
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

function ev(dataset, value) {
  return { currentTarget: { dataset }, detail: { value } }
}

// 5) 跑流程
inst.onLoad()
console.log('pickerList 数量:', inst.data.pickerList.length)

inst.addExercise(ev({ id: '0001' }))
console.log('添加后 session 长度:', inst.data.session.length, '| 名称:', inst.data.session[0].name)

inst.onReps(ev({ idx: 0, sidx: 0 }, '12'))
inst.onWeight(ev({ idx: 0, sidx: 0 }, '60'))
inst.onRest(ev({ idx: 0, sidx: 0 }, '90'))
inst.addSet(ev({ idx: 0 }))
inst.onReps(ev({ idx: 0, sidx: 1 }, '10'))
inst.onWeight(ev({ idx: 0, sidx: 1 }, '62.5'))

inst.save()

setTimeout(() => {
  let ok = true
  if (writes.workouts.length !== 1) { ok = false; console.error('❌ workouts 应写 1 条，实际', writes.workouts.length) }
  if (writes.sets.length !== 2) { ok = false; console.error('❌ sets 应写 2 条，实际', writes.sets.length) }
  const w = writes.workouts[0]
  if (!w.exercises || w.exercises.length !== 1) { ok = false; console.error('❌ workout.exercises 概要错误') }
  if (w.setTotal !== 2) { ok = false; console.error('❌ setTotal 错误', w.setTotal) }
  const s0 = writes.sets[0]
  if (s0.reps !== 12 || s0.weight !== 60 || s0.restSec !== 90) { ok = false; console.error('❌ set0 数值错误', s0) }
  if (s0.exerciseName !== '仰卧起坐' || s0.setIndex !== 1) { ok = false; console.error('❌ set0 元信息错误', s0) }
  const s1 = writes.sets[1]
  if (s1.reps !== 10 || s1.weight !== 62.5 || s1.setIndex !== 2) { ok = false; console.error('❌ set1 数值错误', s1) }

  if (ok) {
    console.log('✅ 自测通过：workouts 1 条 + sets 2 条，数值/元信息正确')
    console.log('workout:', JSON.stringify(w, null, 2))
    console.log('sets:', JSON.stringify(writes.sets, null, 2))
  } else {
    console.log('workout:', JSON.stringify(w, null, 2))
    console.log('sets:', JSON.stringify(writes.sets, null, 2))
    process.exit(1)
  }
}, 300)
