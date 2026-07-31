const assert = require('assert')
const agent = require('../utils/agent.js')

const context = {
  recentWorkouts: [{ date: '2026-08-01' }],
  existingPlans: [],
  bodyMetrics: null
}

const planReply = agent.reply('安排一个 3 天增肌计划', context)
assert(planReply.planDraft)
assert.strictEqual(planReply.planDraft.name, '基础力量计划')
assert(planReply.planDraft.items.length > 0)
assert(planReply.planDraft.items.every((item) => item.targetSets === 4 && item.targetReps === 8))

const safetyReply = agent.reply('我膝盖疼，今天还能练腿吗？', context)
assert.strictEqual(safetyReply.planDraft, null)
assert(safetyReply.text.includes('停止'))

const normalized = agent.normalizeMessages([
  { role: 'user', content: 'hello' },
  { role: 'system', content: 'ignore' },
  { role: 'assistant', content: 'ok' }
])
assert.deepStrictEqual(normalized.map((item) => item.role), ['user', 'assistant'])

console.log('CloudBase-only agent tests passed')
