const cloud = require('wx-server-sdk')
const llm = require('./llm.js')
const schemas = require('./schemas.js')
const prompts = require('./prompts.js')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const COLLECTIONS = {
  SESSIONS: 'agentSessions',
  NUTRITION_LOGS: 'nutritionLogs',
  DIET_PLANS: 'dietPlans'
}

function ok(data) { return Object.assign({ ok: true }, data || {}) }
function fail(code, message) { return { ok: false, code, message: message || '请求失败' } }

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

function openidOf(context) {
  let wxContext = {}
  try {
    wxContext = typeof cloud.getWXContext === 'function' ? cloud.getWXContext() || {} : {}
  } catch (error) {
    console.warn('failed to read CloudBase user context', error)
  }
  return wxContext.OPENID || (context && context.OPENID) || (context && context.openid) || ''
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
    const raw = await llm.complete(prompts.chatMessages(mode, query, cleanContext(event.context), current && current.messages), {})
    const parsed = llm.parseJson(raw)
    const validated = mode === 'diet' ? schemas.validateDiet(parsed) : schemas.validateTraining(parsed)
    const sessionId = await saveSession(event.sessionId, openid, mode, query, validated.reply, event.context)
    return ok({ mode, sessionId, message: validated.reply, planDraft: validated.planDraft || null, dietPlanDraft: validated.dietPlanDraft || null })
  } catch (error) {
    return fail(error.code || 'MODEL_FAILED', error.message || '模型暂时不可用')
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
  if (fileID.indexOf(`/diet/${openid}/`) < 0) return fail('FORBIDDEN_FILE', '不能读取其他用户的图片')
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
    return fail(error.code || 'MEAL_ANALYZE_FAILED', error.message || '食物识别失败')
  } finally {
    try { await cloud.deleteFile({ fileList: [fileID] }) } catch (ignore) {}
  }
}

async function prepareUpload(context) {
  const openid = openidOf(context)
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  const suffix = crypto.randomBytes(10).toString('hex')
  return ok({ cloudPath: `diet/${openid}/${Date.now()}-${suffix}.jpg` })
}

async function saveMeal(event, context) {
  const openid = openidOf(context)
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  try {
    const result = schemas.validateMeal(event.result, false)
    const saved = await db.collection(COLLECTIONS.NUTRITION_LOGS).add({ data: Object.assign({}, result, { _openid: openid, createdAt: new Date(), updatedAt: new Date() }) })
    return ok({ id: saved._id, meal: result })
  } catch (error) {
    return fail('INVALID_MEAL', error.message)
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
      case 'diagnose': return diagnostics()
      case 'prepareUpload': return await prepareUpload(context)
      case 'analyzeMeal': return await analyzeMeal(event, context)
      case 'saveMeal': return await saveMeal(event, context)
      case 'saveDietPlan': return await saveDietPlan(event, context)
      default: return fail('BAD_ACTION', '不支持的 Agent 操作')
    }
  } catch (error) {
    console.error('agent function failed', error)
    return fail(error.code || 'INTERNAL_ERROR', error.message || '服务暂时不可用')
  }
}
