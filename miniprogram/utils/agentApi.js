const cloud = require('./cloud.js')

const SESSION_KEYS = {
  training: 'fitlog_agent_training_session_id',
  diet: 'fitlog_agent_diet_session_id'
}
const REQUEST_TIMEOUT = 25000

function sessionKey(mode) {
  return SESSION_KEYS[mode] || SESSION_KEYS.training
}

function cloudError(error) {
  if (!error) return new Error('CloudBase 请求失败')
  if (!error.code) error.code = error.errCode ? `CLOUD_FUNCTION_${error.errCode}` : 'CLOUD_FUNCTION_UNAVAILABLE'
  if (!error.message) error.message = error.errMsg || 'CloudBase 请求失败，请检查云函数是否已部署'
  return error
}

function call(data, timeout) {
  const request = cloud.callFunction('agent', data)
  const limit = timeout || REQUEST_TIMEOUT
  let timerID
  const timer = new Promise((resolve, reject) => {
    timerID = setTimeout(() => {
      const error = new Error('模型请求超时，请稍后重试')
      error.code = 'MODEL_TIMEOUT'
      reject(error)
    }, limit)
  })
  return Promise.race([request.then((res) => {
    let result = res
    if (typeof result === 'string') {
      try { result = JSON.parse(result) } catch (ignore) {}
    }
    if (result && result.ok === false) {
      const error = new Error(result.message || 'Agent request failed')
      error.code = result.code || 'AGENT_REQUEST_FAILED'
      throw error
    }
    return result
  }).catch((error) => { throw cloudError(error) }), timer])
    .finally(() => clearTimeout(timerID))
}

function chat(mode, query, context, sessionId) {
  return call({ action: 'chat', mode, query, context: context || {}, sessionId: sessionId || '' })
}

function searchExercises(options) {
  const input = options || {}
  return call({
    action: 'searchExercises',
    query: input.query || '',
    bodyPart: input.bodyPart || '',
    target: input.target || '',
    equipment: input.equipment || '',
    limit: input.limit || 8
  })
}

function analyzeMeal(fileID, dateStr, mealType) {
  return call({ action: 'analyzeMeal', fileID, dateStr, mealType }, 35000)
}

function analyzeTextMeal(query, dateStr, mealType) {
  return call({ action: 'analyzeTextMeal', query, dateStr, mealType }, 35000)
}

function prepareUpload() {
  return call({ action: 'prepareUpload' })
}

function registerUpload(fileID) {
  return call({ action: 'registerUpload', fileID: fileID })
}

function saveMeal(result) {
  return call({ action: 'saveMeal', result })
}

function saveDietPlan(plan) {
  return call({ action: 'saveDietPlan', result: plan })
}

function diagnose() {
  return call({ action: 'diagnose' })
}

module.exports = { SESSION_KEYS, sessionKey, call, chat, searchExercises, diagnose, prepareUpload, registerUpload, analyzeMeal, analyzeTextMeal, saveMeal, saveDietPlan }
