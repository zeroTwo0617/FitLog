const assert = require('assert')
const Module = require('module')

const rows = {
  users: [{ _id: 'legacy-user', _openid: 'user-1', nickName: '保留昵称', goal: '增肌' }]
}

function matches(row, where) {
  return Object.keys(where || {}).every((key) => row[key] === where[key])
}

function makeCloudMock() {
  return {
    DYNAMIC_CURRENT_ENV: 'test',
    init: () => {},
    getWXContext: () => ({ OPENID: 'user-1' }),
    database: () => ({
      collection(name) {
        const list = rows[name] || (rows[name] = [])
        let where = null
        const query = {
          where(value) { where = value; return query },
          limit() { return query },
          get() { return Promise.resolve({ data: list.filter((row) => !where || matches(row, where)) }) },
          doc(id) {
            return {
              get() {
                const row = list.find((item) => item._id === id)
                if (!row) {
                  const error = new Error('document does not exist')
                  error.code = 'DATABASE_DOCUMENT_NOT_EXIST'
                  return Promise.reject(error)
                }
                return Promise.resolve({ data: row })
              },
              set({ data, merge }) {
                const current = list.find((item) => item._id === id)
                if (current && merge) Object.assign(current, data)
                else if (current) Object.assign(current, { _id: id }, data)
                else list.push(Object.assign({ _id: id }, data))
                return Promise.resolve({ _id: id })
              }
            }
          }
        }
        return query
      }
    })
  }
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  return request === 'wx-server-sdk' ? makeCloudMock() : originalLoad.call(this, request, parent, isMain)
}

let ensureUser
try {
  ensureUser = require('../cloudfunctions/ensureUser/index.js')
} finally {
  Module._load = originalLoad
}

async function main() {
  const existing = await ensureUser.main()
  assert.strictEqual(existing.ok, true)
  assert.strictEqual(existing.created, false)
  assert.strictEqual(existing.profile.nickName, '保留昵称')

  rows.users = []
  const first = await ensureUser.main()
  const second = await ensureUser.main()
  assert.strictEqual(first.ok, true)
  assert.strictEqual(second.ok, true)
  assert.strictEqual(rows.users.length, 1)
  assert.strictEqual(rows.users[0]._id, 'user-1')
  assert.strictEqual(rows.users[0]._openid, 'user-1')
  assert.ok(rows.users[0].createdAt instanceof Date)
  assert.ok(rows.users[0].lastActiveAt instanceof Date)
  console.log('ensureUser deterministic and merge contract tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
