'use strict'

// 回归测试：保存失败后，同内容重试复用 requestId；内容修改后必须生成新的 requestId。
const assert = require('assert')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pagePath = path.resolve(root, 'miniprogram/pages/record/record.js')
let pageConfig = null
let failNextSave = false
const requestIds = []
const payloads = []

global.Page = (config) => {
  pageConfig = config
  return config
}
global.getApp = () => ({ globalData: { theme: 'dark' } })
global.wx = {
  cloud: {
    callFunction: ({ name, data }) => {
      if (name !== 'saveWorkout') return Promise.reject(new Error('unexpected cloud function: ' + name))
      requestIds.push(data.requestId)
      payloads.push(data)
      if (failNextSave) {
        failNextSave = false
        return Promise.reject(new Error('simulated save failure'))
      }
      return Promise.resolve({ result: { ok: true, result: { workoutId: 'workout-' + requestIds.length } } })
    }
  },
  showToast: () => {},
  showModal: () => {},
  vibrateShort: () => {}
}

function override(relativePath, exports) {
  const filename = path.resolve(root, 'miniprogram', relativePath)
  require.cache[filename] = { id: filename, filename, loaded: true, exports }
}

override('utils/page.js', (config) => Page(config))
override('utils/cloud.js', {
  C: { SETS: 'sets' },
  getAll: () => Promise.resolve([]),
  callFunction: (name, data) => wx.cloud.callFunction({ name, data }).then((res) => res.result)
})
override('utils/auth.js', { ensureUser: () => Promise.resolve({ ok: true }) })
override('utils/exerciseData.js', {
  categoryOptions: () => [],
  list: () => [],
  getById: (id) => ({ id, name: 'exercise-' + id, nameZh: '动作-' + id })
})
override('utils/restTimer.js', {
  DEFAULT_REST: 60,
  MAX_REST: 3600,
  fmtTime: (seconds) => String(seconds),
  remainSec: (endAt, now) => Math.max(0, Math.ceil((endAt - now) / 1000)),
  elapsedPct: () => 0
})

delete require.cache[pagePath]
require(pagePath)

assert.ok(pageConfig, 'record page should register')
const page = Object.assign({}, pageConfig)
page.data = JSON.parse(JSON.stringify(pageConfig.data))
page.setData = function (patch, callback) {
  Object.keys(patch).forEach((key) => {
    if (key.indexOf('.') === -1) {
      this.data[key] = patch[key]
      return
    }
    const parts = key.split('.')
    let target = this.data
    for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]]
    target[parts[parts.length - 1]] = patch[key]
  })
  if (callback) callback()
}

function event(dataset, value) {
  return { currentTarget: { dataset }, detail: { value } }
}

async function saveWithExpectedFailure() {
  const originalError = console.error
  console.error = () => {}
  try {
    await page.save()
  } finally {
    console.error = originalError
  }
}

async function main() {
  page.onLoad()
  page.addExercise(event({ id: '0001' }))
  page.onReps(event({ idx: 0, sidx: 0 }, '12'))

  failNextSave = true
  await saveWithExpectedFailure()
  assert.strictEqual(requestIds.length, 1, 'first save should call saveWorkout once')
  const failedRequestId = requestIds[0]
  assert.strictEqual(page.data.saveRequestId, failedRequestId, 'failed save should retain requestId')
  assert.strictEqual(page.data.session.length, 1, 'failed save should retain edited session')

  failNextSave = true
  await saveWithExpectedFailure()
  assert.strictEqual(requestIds[1], failedRequestId, 'same content retry should reuse requestId')
  assert.strictEqual(page.data.session[0].sets[0].reps, '12', 'same content retry should retain session')

  page.onReps(event({ idx: 0, sidx: 0 }, '13'))
  await page.save()
  assert.notStrictEqual(requestIds[2], failedRequestId, 'modified content should receive a new requestId')
  assert.strictEqual(payloads[2].session[0].sets[0].reps, '13', 'modified content should be sent')
  assert.strictEqual(page.data.session.length, 0, 'successful save should clear the session')
  assert.strictEqual(page.data.saveRequestId, '', 'successful save should clear requestId')
  assert.strictEqual(page.data.saveFingerprint, '', 'successful save should clear fingerprint')

  console.log('record save requestId lifecycle tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
