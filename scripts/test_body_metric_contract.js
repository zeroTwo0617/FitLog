const assert = require('assert')
const Module = require('module')

const writes = []
const cloudMock = {
  DYNAMIC_CURRENT_ENV: 'test',
  init: () => {},
  getWXContext: () => ({ OPENID: 'server-openid' }),
  database: () => ({
    runTransaction: (callback) => callback({
      collection() {
        return {
          where() {
            return { get: () => Promise.resolve({ data: [] }) }
          },
          add({ data }) {
            writes.push(data)
            return Promise.resolve({ _id: 'body-1' })
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

let saveBodyMetric
try {
  saveBodyMetric = require('../cloudfunctions/saveBodyMetric/index.js')
} finally {
  Module._load = originalLoad
}

async function main() {
  const result = await saveBodyMetric.main({
    dateStr: '2026-08-05',
    date: '2000-01-01T00:00:00.000Z',
    weight: 70,
    createdAt: 'client-created-at',
    updatedAt: 'client-updated-at'
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(writes.length, 1)
  assert.ok(writes[0].date instanceof Date)
  assert.ok(writes[0].createdAt instanceof Date)
  assert.ok(writes[0].updatedAt instanceof Date)
  assert.strictEqual(writes[0].dateStr, '2026-08-05')
  assert.notStrictEqual(writes[0].date.toISOString(), '2000-01-01T00:00:00.000Z')
  console.log('body metric server timestamp contract tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
