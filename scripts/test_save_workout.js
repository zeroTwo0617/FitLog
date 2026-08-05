const assert = require('assert')
const Module = require('module')

const store = { workouts: {}, sets: [] }
const cloudMock = {
  DYNAMIC_CURRENT_ENV: 'test',
  init: () => {},
  getWXContext: () => ({ OPENID: 'server-openid' }),
  database: () => ({
    runTransaction: (callback) => callback({
      collection(name) {
        return {
          doc(id) {
            return {
              get: () => Promise.resolve({ data: store[name][id] }),
              set: ({ data }) => {
                store[name][id] = Object.assign({ _id: id }, data)
                return Promise.resolve({ _id: id })
              }
            }
          },
          add: ({ data }) => {
            store[name].push(data)
            return Promise.resolve({ _id: 'set-' + store[name].length })
          }
        }
      }
    })
  })
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  return request === 'wx-server-sdk' ? cloudMock : originalLoad.call(this, request, parent, isMain)
}

let saveWorkout
try {
  saveWorkout = require('../cloudfunctions/saveWorkout/index.js')
} finally {
  Module._load = originalLoad
}

async function main() {
  const event = {
    requestId: 'fitlog-retry-001',
    dateStr: new Date().toISOString().slice(0, 10),
    title: 'Strength',
    session: [{
      exerciseId: '0001',
      name: 'Squat',
      sets: [{ reps: 10, weight: 60, rest: 90, completed: true }]
    }]
  }

  const first = await saveWorkout.main(event)
  const second = await saveWorkout.main(event)
  const missingRequestId = await saveWorkout.main(Object.assign({}, event, { requestId: '' }))

  assert.strictEqual(first.ok, true)
  assert.strictEqual(first.result.idempotent, false)
  assert.strictEqual(second.ok, true)
  assert.strictEqual(second.result.idempotent, true)
  assert.strictEqual(second.result.workoutId, first.result.workoutId)
  assert.strictEqual(Object.keys(store.workouts).length, 1)
  assert.strictEqual(store.sets.length, 1)
  assert.strictEqual(missingRequestId.code, 'INVALID_REQUEST_ID')
  console.log('saveWorkout idempotency contract tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
