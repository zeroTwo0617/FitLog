const assert = require('assert')
const Module = require('module')

const cloudMock = {
  DYNAMIC_CURRENT_ENV: 'test',
  init: () => {},
  getWXContext: () => ({ OPENID: 'server-openid' }),
  database: () => ({})
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  return request === 'wx-server-sdk' ? cloudMock : originalLoad.call(this, request, parent, isMain)
}

let saveWorkout
let saveBodyMetric
try {
  saveWorkout = require('../cloudfunctions/saveWorkout/index.js')
  saveBodyMetric = require('../cloudfunctions/saveBodyMetric/index.js')
} finally {
  Module._load = originalLoad
}

const originalNow = Date.now
async function main() {
  Date.now = () => Date.UTC(2026, 7, 5, 15, 59, 0)
  const beforeMidnightWorkout = await saveWorkout.main({
    requestId: 'fitlog-date-test',
    dateStr: '2026-08-06',
    session: []
  })
  const beforeMidnightBody = await saveBodyMetric.main({ dateStr: '2026-08-06' })
  assert.strictEqual(beforeMidnightWorkout.code, 'INVALID_DATE')
  assert.strictEqual(beforeMidnightBody.code, 'INVALID_DATE')

  Date.now = () => Date.UTC(2026, 7, 5, 16, 1, 0)
  const afterMidnightWorkout = await saveWorkout.main({
    requestId: 'fitlog-date-test',
    dateStr: '2026-08-06',
    session: []
  })
  const afterMidnightBody = await saveBodyMetric.main({ dateStr: '2026-08-06' })
  assert.strictEqual(afterMidnightWorkout.code, 'INVALID_SESSION')
  assert.strictEqual(afterMidnightBody.code, 'INVALID_BODY_METRIC')
  console.log('UTC+8 date contract tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => {
  Date.now = originalNow
})
