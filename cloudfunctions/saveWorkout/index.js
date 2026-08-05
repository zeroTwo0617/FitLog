const cloud = require('wx-server-sdk')
const { normalizeRequestId, workoutIdFor } = require('./idempotency.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_EXERCISES = 30
const MAX_SETS = 200

function fail(code, message) {
  return { ok: false, code, message }
}

// 真实日期校验：格式 YYYY-MM-DD、月份/日期合法（含闰年归一化拦截）、不允许未来日期
function isDateStr(value) {
  const str = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const parts = str.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() <= today.getTime()
}

function numberOrNull(value, min, max, integer) {
  if (value === '' || value == null) return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) return null
  return number
}

function normalizeSession(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_EXERCISES) return null
  let totalSets = 0
  const exercises = []
  const sets = []

  input.forEach((item) => {
    if (!item || !item.exerciseId || !item.name || !Array.isArray(item.sets) || item.sets.length === 0) return
    totalSets += item.sets.length
    exercises.push({
      exerciseId: String(item.exerciseId).slice(0, 80),
      name: String(item.name).slice(0, 100),
      nameEn: String(item.nameEn || '').slice(0, 100),
      setCount: item.sets.length
    })
    item.sets.forEach((set, index) => {
      const reps = numberOrNull(set && set.reps, 0, 1000, true)
      const weight = numberOrNull(set && set.weight, 0, 1000, false)
      const restSec = numberOrNull(set && set.rest, 0, 3600, true)
      if (set && set.reps !== '' && set.reps != null && reps == null) return
      if (set && set.weight !== '' && set.weight != null && weight == null) return
      if (set && set.rest !== '' && set.rest != null && restSec == null) return
      sets.push({
        exerciseId: String(item.exerciseId).slice(0, 80),
        exerciseName: String(item.name).slice(0, 100),
        setIndex: index + 1,
        reps,
        weight,
        restSec,
        completed: !!(set && set.completed)
      })
    })
  })

  if (exercises.length !== input.length || totalSets !== sets.length || totalSets > MAX_SETS) return null
  return { exercises, sets, setTotal: totalSets }
}

function isMissingDocument(error) {
  const message = String(error && (error.errMsg || error.message || '')).toLowerCase()
  const code = String(error && (error.errCode || error.code || '')).toLowerCase()
  return code.indexOf('document_not_exist') >= 0 || code.indexOf('document_not_found') >= 0 ||
    message.indexOf('document does not exist') >= 0 || message.indexOf('document not exist') >= 0
}

exports.main = async function (event) {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')

  const dateStr = String(event && event.dateStr || '')
  if (!isDateStr(dateStr)) return fail('INVALID_DATE', '训练日期无效或晚于今天')
  const normalized = normalizeSession(event && event.session)
  const requestId = normalizeRequestId(event && (event.requestId || event.idempotencyKey))
  if (!requestId) return fail('INVALID_REQUEST_ID', 'requestId is required')
  const workoutId = workoutIdFor(openid, requestId)
  if (!normalized) return fail('INVALID_SESSION', '训练动作或组数据无效')

  try {
    const result = await db.runTransaction(async (transaction) => {
      const now = new Date()
      const workoutRef = transaction.collection('workouts').doc(workoutId)
      let existing
      try {
        existing = await workoutRef.get()
      } catch (error) {
        if (!isMissingDocument(error)) throw error
      }
      if (existing && existing.data) {
        const row = existing.data
        if (row._openid !== openid || row.requestId !== requestId) {
          const conflict = new Error('requestId conflict')
          conflict.code = 'IDEMPOTENCY_CONFLICT'
          throw conflict
        }
        return {
          workoutId: row._id || workoutId,
          setTotal: Number(row.setTotal) || normalized.setTotal,
          savedAt: row.createdAt || now,
          idempotent: true
        }
      }
      await workoutRef.set({
        data: {
          _openid: openid,
          requestId,
          date: now,
          dateStr,
          title: String(event.title || '').slice(0, 100),
          planId: String(event.planId || '').slice(0, 100),
          exercises: normalized.exercises,
          setTotal: normalized.setTotal,
          createdAt: now
        }
      })
      for (const set of normalized.sets) {
        await transaction.collection('sets').add({
          data: Object.assign({}, set, { _openid: openid, sessionId: workoutId, createdAt: now })
        })
      }
      return { workoutId, setTotal: normalized.setTotal, savedAt: now.toISOString(), idempotent: false }
    })
    return { ok: true, result }
  } catch (error) {
    if (error && error.code === 'IDEMPOTENCY_CONFLICT') return fail('IDEMPOTENCY_CONFLICT', error.message)
    console.error('保存训练事务失败', error)
    return fail('SAVE_WORKOUT_FAILED', '训练保存失败，请稍后重试')
  }
}
