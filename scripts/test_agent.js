const assert = require('assert')

const agentContext = require('../miniprogram/utils/agent.js')
const schemas = require('../cloudfunctions/agent/schemas.js')

const calls = []
global.wx = {
  cloud: {
    callFunction: ({ name, data }) => {
      calls.push({ name, data })
      return Promise.resolve({ result: {
        ok: true,
        mode: data.mode,
        sessionId: 'session-test',
        message: 'training plan',
        planDraft: null
      } })
    }
  }
}

async function main() {
  const agentApi = require('../miniprogram/utils/agentApi.js')

  const response = await agentApi.chat('training', '下一周怎么练？', { goal: 'strength' }, 'session-old')
  assert.strictEqual(response.ok, true)
  assert.strictEqual(calls.length, 1)
  assert.strictEqual(calls[0].name, 'agent')
  assert.deepStrictEqual(calls[0].data, {
    action: 'chat',
    mode: 'training',
    query: '下一周怎么练？',
    context: { goal: 'strength' },
    sessionId: 'session-old'
  })

  await agentApi.searchExercises({ query: '胸部 哑铃', limit: 3 })
  assert.deepStrictEqual(calls[1].data, {
    action: 'searchExercises',
    query: '胸部 哑铃',
    bodyPart: '',
    target: '',
    equipment: '',
    limit: 3
  })

  const planReply = schemas.validateTraining({
    reply: 'training plan',
    planDraft: {
      name: 'beginner strength',
      items: [{
        exerciseId: '0001',
        exerciseName: '仰卧起坐',
        targetSets: 4,
        targetReps: 8,
        targetWeight: null
      }]
    }
  })
  assert(planReply.planDraft)
  assert.strictEqual(planReply.planDraft.items.length, 1)
  assert.strictEqual(planReply.planDraft.items[0].exerciseName, '仰卧起坐')

  const invalidPlanReply = schemas.validateTraining({
    reply: 'I need more training context before making a plan.',
    planDraft: { name: 'invalid', items: [{ exerciseId: '', exerciseName: '' }] }
  })
  assert.strictEqual(invalidPlanReply.planDraft, null)

  const safetyReply = schemas.validateTraining({
    reply: 'Please stop training and seek professional advice.',
    planDraft: null
  })
  assert.strictEqual(safetyReply.planDraft, null)

  const normalized = agentContext.normalizeMessages([
    { role: 'user', content: 'hello' },
    { role: 'system', content: 'ignore' },
    { role: 'assistant', content: 'ok' }
  ])
  assert.deepStrictEqual(normalized.map((item) => item.role), ['user', 'assistant'])

  // Load the CloudBase function with a mocked SDK to verify identity is server-derived.
  const Module = require('module')
  const originalLoad = Module._load
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init: () => {},
    database: () => ({
      collection: () => ({
        where: () => ({
          limit: () => ({
            get: () => Promise.resolve({ data: [{ _id: 'session-test', _openid: 'server-openid', messages: [] }] })
          })
        })
      })
    }),
    getWXContext: () => ({ OPENID: 'server-openid' })
  }
  Module._load = function (request, parent, isMain) {
    return request === 'wx-server-sdk' ? cloudMock : originalLoad.call(this, request, parent, isMain)
  }
  let cloudAgent
  try {
    const file = require.resolve('../cloudfunctions/agent/index.js')
    delete require.cache[file]
    cloudAgent = require(file)
  } finally {
    Module._load = originalLoad
  }
  assert.strictEqual(cloudAgent.openidOf({ OPENID: 'client-openid' }), 'server-openid')
  const sessionResult = await cloudAgent.main({ action: 'getSession', sessionId: 'session-test' }, { OPENID: 'client-openid' })
  assert.strictEqual(sessionResult.ok, true)
  assert.strictEqual(sessionResult.session._openid, 'server-openid')
  cloudMock.getWXContext = () => ({})
  assert.strictEqual(cloudAgent.openidOf({ OPENID: 'client-openid' }), '')
  const unauthorized = await cloudAgent.main({ action: 'getSession', sessionId: 'session-test' }, { OPENID: 'client-openid' })
  assert.strictEqual(unauthorized.code, 'AUTH_REQUIRED')

  console.log('CloudBase Agent contract tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
