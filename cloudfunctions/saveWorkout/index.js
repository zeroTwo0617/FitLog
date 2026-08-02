const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_EXERCISES = 30
const MAX_SETS = 200

function fail(code, message) {
  return { ok: false, code, message }
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

exports.main = async function (event) {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')

  const dateStr = String(event && event.dateStr || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fail('INVALID_DATE', '训练日期格式无效')
  const normalized = normalizeSession(event && event.session)
  if (!normalized) return fail('INVALID_SESSION', '训练动作或组数据无效')

  try {
    const result = await db.runTransaction(async (transaction) => {
      const now = new Date()
      const workout = await transaction.collection('workouts').add({
        data: {
          _openid: openid,
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
          data: Object.assign({}, set, { _openid: openid, sessionId: workout._id, createdAt: now })
        })
      }
      return { workoutId: workout._id, setTotal: normalized.setTotal, savedAt: now.toISOString() }
    })
    return { ok: true, result }
  } catch (error) {
    console.error('保存训练事务失败', error)
    return fail('SAVE_WORKOUT_FAILED', '训练保存失败，请稍后重试')
  }
}
