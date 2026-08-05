const assert = require('assert')
const Module = require('module')

const queries = []
const cloudMock = {
  DYNAMIC_CURRENT_ENV: 'test',
  init: () => {},
  getWXContext: () => ({ OPENID: 'server-openid' }),
  database: () => ({
    command: { in: (values) => ({ $in: values }) },
    collection(name) {
      const query = {
        where(condition) {
          queries.push({ name, condition })
          return query
        },
        skip() { return query },
        limit() { return query },
        get() { return Promise.resolve({ data: [] }) }
      }
      return query
    }
  })
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  return request === 'wx-server-sdk' ? cloudMock : originalLoad.call(this, request, parent, isMain)
}

let getDayDetail
try {
  getDayDetail = require('../cloudfunctions/getDayDetail/index.js')
} finally {
  Module._load = originalLoad
}

const dateStr = new Date().toISOString().slice(0, 10)
getDayDetail.main({ dateStr }).then((result) => {
  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(queries[0].condition, { dateStr, _openid: 'server-openid' })
  console.log('getDayDetail server identity contract tests passed')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
