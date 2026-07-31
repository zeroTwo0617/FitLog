// CloudBase-only training assistant.
// It reads the user's cloud data and keeps conversation history in agentSessions.
// The first version is intentionally deterministic so the mini program has no
// backend URL, API key, login token, or streaming request to maintain.
const cloud = require('./cloud.js')
const exercises = require('./exerciseData.js')

const SESSION_KEY = 'fitlog_agent_session_id'
const MAX_MESSAGES = 40

const DEFAULT_MESSAGES = [{
  role: 'assistant',
  content: '告诉我你的训练目标、每周可训练几天，以及有没有需要避开的动作。'
}]

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function safeGet(collection, query) {
  return query(collection).get().then((res) => (res && res.data) || []).catch(() => [])
}

function buildContext() {
  const db = cloud.db()
  return Promise.all([
    safeGet(db.collection(cloud.C.WORKOUTS), (c) => c.orderBy('dateStr', 'desc').limit(10)),
    safeGet(db.collection(cloud.C.PLANS), (c) => c.limit(10)),
    safeGet(db.collection(cloud.C.BODY), (c) => c.orderBy('date', 'desc').limit(3))
  ]).then(([workouts, plans, body]) => ({
    recentWorkouts: workouts.map((item) => ({
      date: item.dateStr || '',
      title: item.title || '',
      exercises: asArray(item.exercises || item.items).slice(0, 12)
    })),
    existingPlans: plans.map((item) => ({
      name: item.name || '',
      items: asArray(item.items).slice(0, 12)
    })),
    bodyMetrics: body[0]
      ? { weight: body[0].weight, height: body[0].height, bodyFat: body[0].bodyFat }
      : null
  }))
}

function normalizeMessages(messages) {
  return asArray(messages)
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({ role: item.role, content: String(item.content || '').slice(0, 1200) }))
    .slice(-MAX_MESSAGES)
}

function loadSession(sessionId) {
  if (!sessionId) return Promise.resolve(null)
  return cloud.collection(cloud.C.AGENT_SESSIONS).doc(sessionId).get()
    .then((res) => res && res.data ? res.data : null)
    .catch(() => null)
}

function persistSession(sessionId, messages, context) {
  const data = {
    messages: normalizeMessages(messages),
    context: context || {},
    updatedAt: new Date()
  }
  const collection = cloud.collection(cloud.C.AGENT_SESSIONS)
  if (sessionId) {
    return collection.doc(sessionId).update({ data }).then(() => sessionId)
  }
  return collection.add({
    data: Object.assign({}, data, { createdAt: new Date(), title: '训练助手会话' })
  }).then((res) => res && res._id)
}

function inferBodyPart(query) {
  if (/腿|下肢|股四|臀|深蹲|硬拉/.test(query)) return 'upper legs'
  if (/胸|卧推|俯卧撑/.test(query)) return 'chest'
  if (/背|划船|引体/.test(query)) return 'back'
  if (/肩|三角肌|推举/.test(query)) return 'shoulders'
  if (/手臂|二头|三头|弯举/.test(query)) return 'upper arms'
  if (/心肺|有氧|燃脂|减脂|体能/.test(query)) return 'cardio'
  return ''
}

function planName(query) {
  if (/减脂|燃脂/.test(query)) return '轻量燃脂计划'
  if (/增肌|力量|力量提升/.test(query)) return '基础力量计划'
  if (/腿|下肢|臀/.test(query)) return '下肢训练计划'
  if (/胸/.test(query)) return '胸部训练计划'
  if (/背/.test(query)) return '背部训练计划'
  return '今日训练计划'
}

function makePlan(query) {
  const bodyPart = inferBodyPart(query)
  let pool = exercises.list(bodyPart ? { bodyPart } : {})
  if (!pool.length) pool = exercises.list({})
  const strength = /增肌|力量/.test(query)
  const cardio = bodyPart === 'cardio'
  const picked = pool.slice(0, cardio ? 3 : 4)
  return {
    name: planName(query),
    items: picked.map((item) => ({
      exerciseId: item.id,
      exerciseName: item.nameZh,
      targetSets: strength ? 4 : 3,
      targetReps: cardio ? 12 : (strength ? 8 : 10),
      targetWeight: null
    }))
  }
}

function reply(query, context) {
  const workouts = asArray(context && context.recentWorkouts)
  const plans = asArray(context && context.existingPlans)
  const hasPlanRequest = /计划|安排|训练|练什么|动作|增肌|减脂|燃脂|力量/.test(query)
  const mentionsPain = /疼|痛|受伤|伤病|不适|康复/.test(query)
  const dataLine = `我看到了你云端的 ${workouts.length} 条近期训练记录和 ${plans.length} 个训练计划。`

  if (mentionsPain) {
    return {
      text: `${dataLine}\n如果动作引起疼痛，请先停止该动作，不要用训练硬扛。建议记录疼痛位置和触发动作，并咨询专业医生或康复师。\n如果你愿意，可以告诉我疼痛位置、出现时间和动作阶段，我再帮你整理低风险的沟通要点。`,
      planDraft: null
    }
  }

  if (!hasPlanRequest) {
    return {
      text: `${dataLine}\n你可以直接告诉我目标，例如“安排一个 3 天增肌计划”或“今天想练腿”。我会根据内置动作库和你的云端记录给出一份可编辑草案。`,
      planDraft: null
    }
  }

  const draft = makePlan(query)
  const names = draft.items.map((item) => item.exerciseName).join('、')
  return {
    text: `${dataLine}\n先给你一份 ${draft.name}：${names}。每个动作先按 ${draft.items[0].targetSets} 组、${draft.items[0].targetReps} 次开始，重量以动作稳定和保留余力为准。你可以在草案里继续调整。`,
    planDraft: draft
  }
}

module.exports = {
  SESSION_KEY,
  DEFAULT_MESSAGES,
  buildContext,
  loadSession,
  persistSession,
  reply,
  normalizeMessages
}
