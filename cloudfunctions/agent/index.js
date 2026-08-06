const cloud = require('wx-server-sdk')
const llm = require('./llm.js')
const schemas = require('./schemas.js')
const prompts = require('./prompts.js')
const exerciseSearch = require('./exercises.js')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const COLLECTIONS = {
  SESSIONS: 'agentSessions',
  UPLOADS: 'agentUploads',
  NUTRITION_LOGS: 'nutritionLogs',
  DIET_PLANS: 'dietPlans'
}

function ok(data) { return Object.assign({ ok: true }, data || {}) }
function fail(code, message) { return { ok: false, code, message: message || '请求失败' } }

function safeErrorMessage(error, fallback) {
  const code = String(error && error.code || '')
  const messages = {
    AUTH_REQUIRED: '请先登录微信云开发',
    INVALID_DATE: '日期无效，请重新选择',
    INVALID_FILE: '图片文件无效，请重新选择',
    FORBIDDEN_FILE: '不能读取其他用户的图片',
    FILE_DOWNLOAD_FAILED: '图片读取失败，请重试',
    MODEL_CONFIG_MISSING: '助手服务暂时离线',
    MODEL_CONFIG_INVALID: '助手服务配置异常',
    MODEL_TIMEOUT: '模型响应超时，请稍后重试',
    MODEL_UNAVAILABLE: '模型服务暂时不可用，请稍后重试',
    MODEL_INVALID_JSON: '模型返回内容暂时无法整理，请重试',
    INVALID_MEAL: '饮食识别数据无效，请重新描述或上传图片',
    INVALID_DIET_PLAN: '饮食计划字段无效，请重新生成',
    REGISTER_UPLOAD_FAILED: '图片登记失败，请重试'
  }
  if (messages[code]) return messages[code]
  if (code.indexOf('MODEL_REQUEST_FAILED_') === 0) return '模型服务请求失败，请稍后重试'
  return fallback || '服务暂时不可用，请稍后重试'
}

function todayInChina() {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const pad = (value) => (value < 10 ? '0' + value : String(value))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

// 真实日期校验：格式 YYYY-MM-DD、月份/日期合法（含闰年归一化拦截）、不允许未来日期。
// CloudBase 运行时可能使用 UTC，产品日期统一按 UTC+8 计算。
function isDateStr(value) {
  const str = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const parts = str.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false
  return str <= todayInChina()
}

function diagnostics() {
  return ok({
    provider: 'openai-compatible',
    config: llm.configStatus()
  })
}

function openidOf() {
  let wxContext = {}
  try {
    wxContext = typeof cloud.getWXContext === 'function' ? cloud.getWXContext() || {} : {}
  } catch (error) {
    console.warn('failed to read CloudBase user context', error)
  }
  return wxContext.OPENID || ''
}

function cleanContext(context) {
  const source = context || {}
  return {
    goal: String(source.goal || '').slice(0, 200),
    constraints: Array.isArray(source.constraints) ? source.constraints.slice(0, 12).map((item) => String(item).slice(0, 120)) : [],
    recentWorkouts: Array.isArray(source.recentWorkouts) ? source.recentWorkouts.slice(0, 10).map((item) => ({
      date: String(item && item.date || '').slice(0, 30),
      title: String(item && item.title || '').slice(0, 100),
      exercises: Array.isArray(item && item.exercises) ? item.exercises.slice(0, 12).map((exercise) => ({
        exerciseId: String(exercise && (exercise.exerciseId || exercise.id) || '').slice(0, 80),
        name: String(exercise && (exercise.name || exercise.exerciseName) || '').slice(0, 100),
        setCount: Number(exercise && exercise.setCount) || 0
      })) : []
    })) : [],
    existingPlans: Array.isArray(source.existingPlans) ? source.existingPlans.slice(0, 10).map((item) => ({
      name: String(item && item.name || '').slice(0, 100),
      items: Array.isArray(item && item.items) ? item.items.slice(0, 12).map((exercise) => ({
        exerciseId: String(exercise && exercise.exerciseId || '').slice(0, 80),
        exerciseName: String(exercise && exercise.exerciseName || '').slice(0, 100),
        targetSets: Number(exercise && exercise.targetSets) || 0,
        targetReps: Number(exercise && exercise.targetReps) || 0
      })) : []
    })) : [],
    recentMeals: Array.isArray(source.recentMeals) ? source.recentMeals.slice(0, 30).map((item) => ({
      dateStr: String(item && item.dateStr || '').slice(0, 30),
      mealType: String(item && item.mealType || 'other').slice(0, 20),
      calories: Number(item && item.calories) || 0,
      protein: Number(item && item.protein) || 0,
      carbs: Number(item && item.carbs) || 0,
      fat: Number(item && item.fat) || 0
    })) : [],
    existingDietPlans: Array.isArray(source.existingDietPlans) ? source.existingDietPlans.slice(0, 5).map((item) => ({
      name: String(item && item.name || '').slice(0, 100),
      dailyTarget: item && item.dailyTarget ? item.dailyTarget : {},
      meals: Array.isArray(item && item.meals) ? item.meals.slice(0, 8) : []
    })) : [],
    bodyMetrics: source.bodyMetrics && typeof source.bodyMetrics === 'object' ? {
      height: Number(source.bodyMetrics.height) || null,
      weight: Number(source.bodyMetrics.weight) || null,
      bodyFat: Number(source.bodyMetrics.bodyFat || source.bodyMetrics.fatPct) || null
    } : null
  }
}

async function sessionOf(sessionId, openid) {
  if (!sessionId) return null
  const result = await db.collection(COLLECTIONS.SESSIONS).where({ _id: sessionId, _openid: openid }).limit(1).get()
  return result.data && result.data[0] ? result.data[0] : null
}

async function getSession(event, context) {
  const openid = openidOf(context)
  const sessionId = String(event && event.sessionId || '').trim()
  if (!openid) return fail('AUTH_REQUIRED', 'AUTH_REQUIRED')
  if (!sessionId || sessionId.length > 128) return fail('INVALID_SESSION', 'Invalid sessionId')
  try {
    return ok({ session: await sessionOf(sessionId, openid) })
  } catch (error) {
    return fail('GET_SESSION_FAILED', 'Unable to load agent session')
  }
}

async function saveSession(sessionId, openid, mode, query, reply, context) {
  const appendMessages = (messages) => {
    const previous = Array.isArray(messages) ? messages : []
    return previous.concat([
      { role: 'user', content: String(query).slice(0, 1200) },
      { role: 'assistant', content: String(reply).slice(0, 3000) }
    ]).slice(-40)
  }
  const now = new Date()
  // 会话已存在：用事务读-追加-写，避免两个并发请求各自基于旧 messages 覆盖对方。
  if (sessionId) {
    const current = await sessionOf(sessionId, openid)
    if (current) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const done = await db.runTransaction(async (transaction) => {
            const latest = await transaction.collection(COLLECTIONS.SESSIONS).doc(sessionId).get()
            const row = latest && latest.data
            if (!row || row._openid !== openid) return false
            const messages = appendMessages(row.messages)
            await transaction.collection(COLLECTIONS.SESSIONS).doc(sessionId).update({ data: { messages, context: cleanContext(context), updatedAt: new Date() } })
            return true
          })
          if (done) return sessionId
        } catch (error) {
          // 写冲突（并发更新同一会话）时重试
          if (attempt >= 2) throw error
        }
      }
      throw new Error('会话并发更新多次冲突')
    }
  }
  // 会话不存在：创建（首次创建无并发覆盖问题）
  const created = await db.collection(COLLECTIONS.SESSIONS).add({
    data: {
      _openid: openid,
      mode,
      title: mode === 'diet' ? '饮食助手会话' : '训练助手会话',
      messages: appendMessages([]),
      context: cleanContext(context),
      createdAt: now,
      updatedAt: now
    }
  })
  return created._id
}

async function chat(event, context) {
  const openid = openidOf(context)
  const mode = event.mode === 'diet' ? 'diet' : 'training'
  const query = String(event.query || '').trim()
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  if (!query || query.length > 1200) return fail('INVALID_QUERY', '问题不能为空且不能超过 1200 字')
  const current = await sessionOf(event.sessionId, openid)
  try {
    const raw = await completeTraining(prompts.chatMessages(mode, query, cleanContext(event.context), current && current.messages), mode)
    const parsed = llm.parseJson(raw)
    const validated = mode === 'diet' ? schemas.validateDiet(parsed) : schemas.validateTraining(parsed)
    const sessionId = await saveSession(event.sessionId, openid, mode, query, validated.reply, event.context)
    return ok({ mode, sessionId, message: validated.reply, planDraft: validated.planDraft || null, dietPlanDraft: validated.dietPlanDraft || null })
  } catch (error) {
    return fail(error.code || 'MODEL_FAILED', safeErrorMessage(error, '训练助手暂时不可用'))
  }
}

function imageMime(fileID) {
  return /\.(png)$/i.test(fileID) ? 'image/png' : (/\.(webp)$/i.test(fileID) ? 'image/webp' : 'image/jpeg')
}

async function analyzeMeal(event, context) {
  const openid = openidOf(context)
  const fileID = String(event.fileID || '')
  const dateStr = String(event.dateStr || '')
  const mealType = String(event.mealType || 'other')
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  if (!fileID.startsWith('cloud://')) return fail('INVALID_FILE', '食物图片文件无效')
  if (!isOwnedFile(fileID, openid)) return fail('FORBIDDEN_FILE', '不能读取其他用户的图片')
  if (!isDateStr(dateStr)) return fail('INVALID_DATE', '饮食日期无效或晚于今天')
  let downloaded
  try {
    downloaded = await cloud.downloadFile({ fileID })
    if (!downloaded || !downloaded.fileContent) return fail('FILE_DOWNLOAD_FAILED', '图片读取失败')
    const content = [
      { type: 'text', text: `记录日期：${dateStr}；餐次：${mealType}。请估算图片中的食物和份量。` },
      { type: 'image_url', image_url: { url: `data:${imageMime(fileID)};base64,${downloaded.fileContent.toString('base64')}` } }
    ]
    const raw = await llm.complete([
      { role: 'system', content: prompts.mealMessages(dateStr, mealType)[0].content },
      { role: 'user', content }
    ], { vision: true })
    const parsed = llm.parseJson(raw)
    const result = schemas.validateMeal(Object.assign({}, parsed, { dateStr, mealType, source: 'photo' }), true)
    return ok({ meal: result })
  } catch (error) {
    return fail(error.code || 'MEAL_ANALYZE_FAILED', safeErrorMessage(error, '食物识别失败'))
  } finally {
    try { await cloud.deleteFile({ fileList: [fileID] }) } catch (ignore) {}
    await forgetUpload(fileID, openid)
  }
}

function toolUnsupported(error) {
  const code = String(error && error.code || '')
  return code.indexOf('MODEL_REQUEST_FAILED_400') === 0 || code.indexOf('MODEL_REQUEST_FAILED_404') === 0 || code.indexOf('MODEL_REQUEST_FAILED_415') === 0 || code.indexOf('MODEL_REQUEST_FAILED_422') === 0
}

function parseToolArguments(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(String(value || '{}'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch (ignore) { return null }
}

function messageContent(message) {
  const value = message && message.content
  if (Array.isArray(value)) return value.map((item) => item && item.text ? item.text : '').join('')
  return String(value || '')
}

async function completeTraining(messages, mode) {
  if (mode !== 'training') return llm.complete(messages, {})
  if (typeof llm.completeMessage !== 'function') return llm.complete(messages, {})

  let first
  try {
    first = await llm.completeMessage(messages, { tools: [prompts.exerciseSearchTool()] })
  } catch (error) {
    if (toolUnsupported(error)) return llm.complete(messages, {})
    throw error
  }

  const calls = Array.isArray(first && first.tool_calls) ? first.tool_calls.slice(0, 3) : []
  if (!calls.length) {
    const content = messageContent(first)
    return content || llm.complete(messages, {})
  }

  const toolMessages = messages.slice()
  toolMessages.push({
    role: 'assistant',
    content: first.content || null,
    tool_calls: calls
  })
  calls.forEach((call, index) => {
    const name = call && call.function && call.function.name
    const args = parseToolArguments(call && call.function && call.function.arguments)
    const result = name === 'search_exercises' && args
      ? exerciseSearch.search(args)
      : { query: '', total: 0, exercises: [] }
    toolMessages.push({
      role: 'tool',
      tool_call_id: String(call && call.id || `search-${index}`),
      name: name || 'search_exercises',
      content: JSON.stringify(result)
    })
  })

  const finalMessage = await llm.completeMessage(toolMessages, {})
  const content = messageContent(finalMessage)
  if (!content) {
    const error = new Error('Model returned no final response after exercise search')
    error.code = 'MODEL_BAD_RESPONSE'
    throw error
  }
  return content
}

async function searchExercises(event, context) {
  const openid = openidOf(context)
  if (!openid) return fail('AUTH_REQUIRED', 'AUTH_REQUIRED')
  const input = event || {}
  if (String(input.query || '').length > exerciseSearch.MAX_QUERY_LENGTH ||
      String(input.bodyPart || '').length > 40 ||
      String(input.target || '').length > 40 ||
      String(input.equipment || '').length > 40) {
    return fail('INVALID_EXERCISE_SEARCH', 'Search parameters are too long')
  }
  const limit = Number(input.limit || 8)
  if (!Number.isInteger(limit) || limit < 1 || limit > exerciseSearch.MAX_LIMIT) {
    return fail('INVALID_EXERCISE_SEARCH', 'Search limit must be between 1 and 12')
  }
  return ok(exerciseSearch.search({
    query: input.query,
    bodyPart: input.bodyPart,
    target: input.target,
    equipment: input.equipment,
    limit
  }))
}

async function analyzeTextMeal(event, context) {
  const openid = openidOf(context)
  const query = String(event.query || '').trim()
  const dateStr = String(event.dateStr || '')
  const mealType = String(event.mealType || 'other')
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  if (!query || query.length > 1200) return fail('INVALID_QUERY', '饮食描述不能为空且不能超过 1200 字')
  if (!isDateStr(dateStr)) return fail('INVALID_DATE', '饮食日期无效或晚于今天')
  try {
    const raw = await llm.complete(prompts.textMealMessages(dateStr, mealType, query), {})
    const parsed = llm.parseJson(raw)
    const result = schemas.validateMeal(Object.assign({}, parsed, { dateStr, mealType, source: 'agent' }), true)
    return ok({ meal: result })
  } catch (error) {
    return fail(error.code || 'MEAL_TEXT_ANALYZE_FAILED', safeErrorMessage(error, '文字饮食分析失败'))
  }
}

async function prepareUpload(context) {
  const openid = openidOf(context)
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  const suffix = crypto.randomBytes(10).toString('hex')
  return ok({ cloudPath: `diet/${openid}/${Date.now()}-${suffix}.jpg` })
}

function isOwnedFile(fileID, openid) {
  return fileID.startsWith('cloud://') && fileID.indexOf(`/diet/${openid}/`) >= 0
}

async function registerUpload(event, context) {
  const openid = openidOf(context)
  const fileID = String(event && event.fileID || '')
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  if (!isOwnedFile(fileID, openid)) return fail('FORBIDDEN_FILE', '不能登记其他用户的图片')
  try {
    const existing = await db.collection(COLLECTIONS.UPLOADS).where({ _openid: openid, fileID }).limit(1).get()
    if (existing.data && existing.data[0]) {
      await db.collection(COLLECTIONS.UPLOADS).doc(existing.data[0]._id).update({ data: { updatedAt: new Date() } })
      return ok({ fileID, created: false })
    }
    const now = new Date()
    const saved = await db.collection(COLLECTIONS.UPLOADS).add({ data: { _openid: openid, fileID, createdAt: now, updatedAt: now } })
    return ok({ fileID, id: saved._id, created: true })
  } catch (error) {
    return fail('REGISTER_UPLOAD_FAILED', '图片登记失败，请重试')
  }
}

async function forgetUpload(fileID, openid) {
  if (!fileID || !openid) return
  try {
    await db.collection(COLLECTIONS.UPLOADS).where({ _openid: openid, fileID }).remove()
  } catch (ignore) {}
}

async function saveMeal(event, context) {
  const openid = openidOf(context)
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  try {
    const result = schemas.validateMeal(event.result, false)
    const saved = await db.collection(COLLECTIONS.NUTRITION_LOGS).add({ data: Object.assign({}, result, { _openid: openid, createdAt: new Date(), updatedAt: new Date() }) })
    return ok({ id: saved._id, meal: result })
  } catch (error) {
    return fail(error.code || 'INVALID_MEAL', safeErrorMessage(error, '饮食数据无效'))
  }
}

async function saveDietPlan(event, context) {
  const openid = openidOf(context)
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  const draft = event.result || {}
  if (!draft.name || !Array.isArray(draft.meals)) return fail('INVALID_DIET_PLAN', '饮食计划无效')
  const validated = schemas.validateDiet({ reply: 'confirmed', dietPlanDraft: draft }).dietPlanDraft
  if (!validated) return fail('INVALID_DIET_PLAN', '饮食计划字段无效')
  const data = {
    _openid: openid,
    name: validated.name,
    goal: validated.goal,
    dailyTarget: validated.dailyTarget,
    meals: validated.meals,
    constraints: validated.constraints,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  const saved = await db.collection(COLLECTIONS.DIET_PLANS).add({ data })
  return ok({ id: saved._id, dietPlan: data })
}

exports.main = async (event, context) => {
  try {
    switch (event && event.action) {
      case 'chat': return await chat(event, context)
      case 'searchExercises': return await searchExercises(event, context)
      case 'getSession': return await getSession(event, context)
      case 'diagnose': return diagnostics()
      case 'prepareUpload': return await prepareUpload(context)
      case 'registerUpload': return await registerUpload(event, context)
      case 'analyzeMeal': return await analyzeMeal(event, context)
      case 'analyzeTextMeal': return await analyzeTextMeal(event, context)
      case 'saveMeal': return await saveMeal(event, context)
      case 'saveDietPlan': return await saveDietPlan(event, context)
      default: return fail('BAD_ACTION', '不支持的 Agent 操作')
    }
  } catch (error) {
    console.error('agent function failed', error)
    return fail(error.code || 'INTERNAL_ERROR', safeErrorMessage(error))
  }
}

// Exposed only for the local contract test; the CloudBase entry point remains `main`.
exports.openidOf = openidOf
