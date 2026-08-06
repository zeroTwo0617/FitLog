const assert = require('assert')
const Module = require('module')
const search = require('../cloudfunctions/agent/exercises.js')
const schemas = require('../cloudfunctions/agent/schemas.js')
const preset = require('../miniprogram/data/exercises.preset.js')
const index = require('../cloudfunctions/agent/exercises.index.js')

function loadAgent(cloudMock, llmMock) {
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock
    if (request === './llm.js' && llmMock) return llmMock
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    const file = require.resolve('../cloudfunctions/agent/index.js')
    delete require.cache[file]
    return require(file)
  } finally {
    Module._load = originalLoad
  }
}

async function main() {
  assert.strictEqual(index.length, preset.length)
  assert(index.every((item) => item.id && item.name && Object.keys(item).indexOf('steps') < 0))

  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init: () => {},
    database: () => ({}),
    getWXContext: () => ({ OPENID: 'search-user' })
  }
  const agent = loadAgent(cloudMock, { complete: () => Promise.resolve('{}') })

  const response = await agent.main({
    action: 'searchExercises',
    query: '胸部 哑铃',
    limit: 50
  })
  assert.strictEqual(response.ok, false)
  assert.strictEqual(response.code, 'INVALID_EXERCISE_SEARCH')

  const valid = await agent.main({
    action: 'searchExercises',
    query: '胸部 哑铃',
    limit: 3
  })
  assert.strictEqual(valid.ok, true)
  assert(valid.total > 0)
  assert.strictEqual(valid.exercises.length, 3)
  valid.exercises.forEach((item) => {
    assert(item.exerciseId)
    assert(item.exerciseName)
    assert.strictEqual(item.bodyPart, 'chest')
    assert.strictEqual(item.equipment, 'dumbbell')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(item, 'steps'), false)
  })

  const unauthorized = loadAgent(Object.assign({}, cloudMock, { getWXContext: () => ({}) }), { complete: () => Promise.resolve('{}') })
  const denied = await unauthorized.main({ action: 'searchExercises', query: 'squat' })
  assert.strictEqual(denied.code, 'AUTH_REQUIRED')

  const validPlan = schemas.validateTraining({
    reply: 'ok',
    planDraft: { name: 'test', items: [{ exerciseId: '0001', exerciseName: 'wrong name', targetSets: 3, targetReps: 10, targetWeight: null }] }
  })
  assert(validPlan.planDraft)
  assert.strictEqual(validPlan.planDraft.items[0].exerciseName, '仰卧起坐')

  const invalidPlan = schemas.validateTraining({
    reply: 'ok',
    planDraft: { name: 'test', items: [{ exerciseId: 'not-real', exerciseName: 'fake', targetSets: 3, targetReps: 10, targetWeight: null }] }
  })
  assert.strictEqual(invalidPlan.planDraft, null)

  let toolCalls = 0
  const chatCloud = {
    DYNAMIC_CURRENT_ENV: 'test',
    init: () => {},
    database: () => ({
      collection: () => ({
        add: ({ data }) => Promise.resolve({ _id: 'session-tool-test', data }),
        where: () => ({ limit: () => ({ get: () => Promise.resolve({ data: [] }) }) })
      })
    }),
    getWXContext: () => ({ OPENID: 'chat-user' })
  }
  const chatLlm = {
    completeMessage: (messages, options) => {
      toolCalls += 1
      if (options && options.tools) {
        assert.strictEqual(options.tools[0].function.name, 'search_exercises')
        return Promise.resolve({
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'search_exercises', arguments: '{"query":"0001"}' } }]
        })
      }
      const last = messages[messages.length - 1]
      assert.strictEqual(last.role, 'tool')
      return Promise.resolve({
        role: 'assistant',
        content: JSON.stringify({ reply: '已找到动作', planDraft: { name: '测试计划', items: [{ exerciseId: '0001', exerciseName: '仰卧起坐', targetSets: 3, targetReps: 10, targetWeight: null }] } })
      })
    },
    parseJson: JSON.parse,
    configStatus: () => ({})
  }
  const chatAgent = loadAgent(chatCloud, chatLlm)
  const chat = await chatAgent.main({ action: 'chat', mode: 'training', query: '找一个核心动作', context: {} })
  assert.strictEqual(chat.ok, true)
  assert.strictEqual(toolCalls, 2)
  assert.strictEqual(chat.planDraft.items[0].exerciseId, '0001')

  console.log('Agent exercise search contract tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
