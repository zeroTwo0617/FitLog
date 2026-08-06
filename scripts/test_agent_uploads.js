const assert = require('assert')
const Module = require('module')

function loadWithMocks(file, cloudMock, llmMock) {
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock
    if (request === './llm.js' && llmMock) return llmMock
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    const resolved = require.resolve(file)
    delete require.cache[resolved]
    return require(resolved)
  } finally {
    Module._load = originalLoad
  }
}

function matches(row, where) {
  return Object.keys(where || {}).every((key) => {
    const condition = where[key]
    if (condition && Array.isArray(condition.$in)) return condition.$in.indexOf(row[key]) >= 0
    return row[key] === condition
  })
}

function makeDatabase(rowsByCollection) {
  return {
    command: { in: (values) => ({ $in: values }) },
    collection(name) {
      const rows = rowsByCollection[name] || (rowsByCollection[name] = [])
      let where = null
      const query = {
        where(value) { where = value; return query },
        skip() { return query },
        limit() { return query },
        get() { return Promise.resolve({ data: rows.filter((row) => !where || matches(row, where)) }) },
        remove() {
          const kept = rows.filter((row) => where && !matches(row, where))
          const removed = rows.length - kept.length
          rows.splice(0, rows.length, ...kept)
          return Promise.resolve({ stats: { removed } })
        },
        add({ data }) {
          const row = Object.assign({ _id: `${name}-${rows.length + 1}` }, data)
          rows.push(row)
          return Promise.resolve({ _id: row._id })
        },
        doc(id) {
          return {
            update({ data }) {
              const row = rows.find((item) => item._id === id)
              if (row) Object.assign(row, data)
              return Promise.resolve({ stats: { updated: row ? 1 : 0 } })
            }
          }
        }
      }
      return query
    }
  }
}

async function testAgentFlow() {
  const rows = { agentUploads: [] }
  const deletedFiles = []
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init: () => {},
    database: () => makeDatabase(rows),
    getWXContext: () => ({ OPENID: 'user-1' }),
    downloadFile: () => Promise.resolve({ fileContent: Buffer.from('image') }),
    deleteFile: ({ fileList }) => { deletedFiles.push(...fileList); return Promise.resolve({ fileList }) }
  }
  const llmMock = {
    complete: () => Promise.resolve('meal'),
    parseJson: () => ({
      foods: [{ name: '鸡蛋', portion: '2 个', calories: 140, protein: 12, carbs: 1, fat: 10 }],
      calories: 140,
      protein: 12,
      carbs: 1,
      fat: 10,
      confidence: 0.9,
      note: '估算值'
    }),
    configStatus: () => ({})
  }
  const agent = loadWithMocks('../cloudfunctions/agent/index.js', cloudMock, llmMock)
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const dateStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
  const fileID = 'cloud://env/diet/user-1/meal.jpg'

  const forbidden = await agent.main({ action: 'registerUpload', fileID: 'cloud://env/diet/other-user/meal.jpg' })
  assert.strictEqual(forbidden.code, 'FORBIDDEN_FILE')
  const registered = await agent.main({ action: 'registerUpload', fileID })
  assert.strictEqual(registered.ok, true)
  assert.strictEqual(rows.agentUploads.length, 1)

  const analyzed = await agent.main({ action: 'analyzeMeal', fileID, dateStr, mealType: 'breakfast' })
  assert.strictEqual(analyzed.ok, true)
  assert.deepStrictEqual(deletedFiles, [fileID])
  assert.strictEqual(rows.agentUploads.length, 0)
  console.log('Agent upload registration and analysis cleanup tests passed')
}

async function testDeletePartialFlow() {
  const failedFile = 'cloud://env/diet/user-1/fail.jpg'
  const rows = {
    agentUploads: [
      { _id: 'upload-ok', _openid: 'user-1', fileID: 'cloud://env/diet/user-1/ok.jpg' },
      { _id: 'upload-fail', _openid: 'user-1', fileID: failedFile }
    ],
    workouts: [{ _id: 'workout-1', _openid: 'user-1' }],
    sets: [{ _id: 'set-1', _openid: 'user-1' }],
    plans: [{ _id: 'plan-1', _openid: 'user-1' }],
    bodyMetrics: [{ _id: 'body-1', _openid: 'user-1' }],
    nutritionLogs: [{ _id: 'nutrition-1', _openid: 'user-1' }],
    dietPlans: [{ _id: 'diet-1', _openid: 'user-1' }],
    agentSessions: [{ _id: 'session-1', _openid: 'user-1' }],
    users: [{ _id: 'user-1', _openid: 'user-1' }]
  }
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init: () => {},
    database: () => makeDatabase(rows),
    getWXContext: () => ({ OPENID: 'user-1' }),
    deleteFile: ({ fileList }) => fileList.indexOf(failedFile) >= 0
      ? Promise.reject(new Error('storage unavailable'))
      : Promise.resolve({ fileList })
  }
  const remover = loadWithMocks('../cloudfunctions/deleteUserData/index.js', cloudMock)
  const originalError = console.error
  console.error = () => {}
  let result
  try {
    result = await remover.main()
  } finally {
    console.error = originalError
  }
  assert.strictEqual(result.code, 'DELETE_USER_DATA_PARTIAL')
  assert.strictEqual(rows.agentUploads.length, 1)
  assert.strictEqual(rows.agentUploads[0].fileID, failedFile)
  console.log('Partial user deletion preserves failed upload cleanup records')
}

Promise.resolve()
  .then(testAgentFlow)
  .then(testDeletePartialFlow)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
