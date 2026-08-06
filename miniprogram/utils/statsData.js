// 统计 / 日历 / 身体数据 纯函数（不依赖 wx，便于单测）
// 对齐 开发文档.md §5.2 workouts / §5.3 sets / §5.5 body_records / §5.7 打卡日历
const workoutData = require('./workoutData.js')
const dateUtil = require('./date.js')

function fmtDate(d) {
  return dateUtil.dateString(d)
}

// 返回最近 n 天的 dateStr 数组（含今天），升序
function lastNDates(n, endDate) {
  const end = endDate ? dateUtil.dateString(endDate) : dateUtil.todayString()
  const arr = []
  for (let i = n - 1; i >= 0; i--) {
    arr.push(dateUtil.addDaysString(end, -i))
  }
  return arr
}

// 单组训练量 = reps * weight（kg），缺项记 0（计时/距离/自重类不参与容量）
function volumeOf(set) {
  const reps = Number(set.reps)
  const weight = Number(set.weight)
  if (!reps || !weight) return 0
  return Math.round(reps * weight)
}

function exerciseNameMap(workouts) {
  const result = {}
  ;(workouts || []).forEach((workout) => {
    ;(workout && workout.exercises || []).forEach((exercise) => {
      const id = exercise && (exercise.exerciseId || exercise.id)
      const name = exercise && (exercise.name || exercise.exerciseName || exercise.nameZh)
      if (id && name) result[id] = String(name).trim()
    })
  })
  return result
}

function resolveExerciseName(set, namesById) {
  const direct = set && (set.exerciseName || set.name || set.nameZh)
  if (direct && String(direct).trim()) return String(direct).trim()
  const id = set && (set.exerciseId || set.exercise)
  if (id && namesById[id]) return namesById[id]
  return id ? String(id) : ''
}

function workoutDateMap(workouts) {
  const result = {}
  ;(workouts || []).forEach((w) => {
    if (!w || !w._id) return
    const date = workoutData.dateKey(w)
    if (date) result[w._id] = date
  })
  return result
}

// 聚合：训练量、动作最大重量、打卡日
// workouts: [{_id, dateStr, ...}]；sets: [{sessionId, exerciseId, exerciseName, reps, weight, ...}]
function aggregate(workouts, sets) {
  const wMap = workoutDateMap(workouts)
  const namesById = exerciseNameMap(workouts)
  const workoutSummary = workoutData.summarize(workouts)

  const byDateMap = {}
  const dayEx = {}
  const exMax = {}
  let totalVolume = 0

  // 训练日来自 workouts，而不是 completed sets。这样日历、统计、历史保持同一口径。
  workoutSummary.trainedDates.forEach((dateStr) => {
    byDateMap[dateStr] = { dateStr, volume: 0, setsCount: 0, exerciseCount: 0 }
  })

  ;(sets || []).forEach((s) => {
    if (s.completed === false) return // 未勾完成的组不计入统计（旧数据无该字段，不受影响）
    const dateStr = wMap[s.sessionId]
    if (!dateStr) return
    const exerciseName = resolveExerciseName(s, namesById)
    const vol = volumeOf(s)
    totalVolume += vol
    if (!byDateMap[dateStr]) byDateMap[dateStr] = { dateStr, volume: 0, setsCount: 0, exerciseCount: 0 }
    byDateMap[dateStr].volume += vol
    byDateMap[dateStr].setsCount += 1
    if (!dayEx[dateStr]) dayEx[dateStr] = {}
    dayEx[dateStr][s.exerciseId || exerciseName] = true
    const w = Number(s.weight)
    if (w > 0 && exerciseName) {
      if (!exMax[exerciseName] || w > exMax[exerciseName]) exMax[exerciseName] = w
    }
  })

  Object.keys(dayEx).forEach((d) => {
    if (byDateMap[d]) byDateMap[d].exerciseCount = Object.keys(dayEx[d]).length
  })

  const byDate = Object.keys(byDateMap)
    .map((k) => byDateMap[k])
    .sort((a, b) => (a.dateStr < b.dateStr ? -1 : 1))

  const allByExercise = Object.keys(exMax)
    .map((name) => ({ name, max: exMax[name] }))
    .sort((a, b) => b.max - a.max)
  const maxByExercise = allByExercise.slice(0, 5)

  const totalWorkouts = workoutSummary.totalWorkouts
  const trainedDates = workoutSummary.trainedDates
  return { totalWorkouts, totalVolume, byDate, maxByExercise, allByExercise, trainedDates }
}

// 近 n 天训练量趋势（用于折线/柱状图）。endDate 可指定窗口终点（锚定最近有数据的日期）
// 返回 [{dateStr, day, volume, heightPct, trained}]
function volumeTrend(agg, n, endDate) {
  const dates = lastNDates(n, endDate)
  const map = {}
  ;(agg.byDate || []).forEach((d) => { map[d.dateStr] = d.volume })
  const trained = new Set(agg.trainedDates)
  const maxVol = dates.reduce((m, ds) => Math.max(m, map[ds] || 0), 0)
  return dates.map((ds) => {
    const vol = map[ds] || 0
    return {
      dateStr: ds,
      day: Number(ds.slice(8, 10)),
      volume: vol,
      heightPct: maxVol > 0 ? Math.round((vol / maxVol) * 100) : 0,
      trained: trained.has(ds)
    }
  })
}

// 当月打卡日历网格。year/month 为数字（month 1-12）；trainedDates 为 dateStr 数组
function buildCalendar(year, month, trainedDates) {
  const trained = new Set(trainedDates || [])
  const first = new Date(Date.UTC(year, month - 1, 1))
  const startWeekday = first.getUTCDay() // 0=周日
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const todayStr = dateUtil.todayString()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push({ day: '', dateStr: '', trained: false, isToday: false })
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = month < 10 ? '0' + month : '' + month
    const dd = d < 10 ? '0' + d : '' + d
    const ds = year + '-' + mm + '-' + dd
    cells.push({ day: d, dateStr: ds, trained: trained.has(ds), isToday: ds === todayStr })
  }
  return cells
}

// 身体数据体重趋势（按日期升序）。返回 [{dateStr, weight, heightPct, fatPct?}]
function bodyTrend(records, field) {
  const list = (records || [])
    .slice()
    .sort((a, b) => (a.dateStr < b.dateStr ? -1 : 1))
  const vals = list.map((r) => Number(r[field])).filter((v) => v > 0)
  const max = vals.length ? Math.max.apply(null, vals) : 0
  const min = vals.length ? Math.min.apply(null, vals) : 0
  const span = (max - min) || 1
  return list.map((r) => {
    const v = Number(r[field]) || 0
    // 映射到 20%-100%，保证最小体重也有可见高度且不超过容器
    const heightPct = (max > 0 && v > 0) ? Math.round(20 + ((v - min) / span) * 80) : 0
    return {
      dateStr: r.dateStr,
      value: v,
      heightPct: heightPct,
      fatPct: r.fatPct || ''
    }
  })
}

// Epley 公式估算 1RM（kg）：weight × (1 + reps/30)。缺次数时退化为重量本身
function estimate1RM(weight, reps) {
  const w = Number(weight)
  const r = Number(reps)
  if (!w || w <= 0) return 0
  if (!r || r <= 0) return w
  return Math.round(w * (1 + r / 30) * 10) / 10
}

function latestExerciseDate(workouts, sets, exerciseName) {
  const wMap = workoutDateMap(workouts)
  const namesById = exerciseNameMap(workouts)
  let latest = ''
  ;(sets || []).forEach((s) => {
    if (s.completed === false || resolveExerciseName(s, namesById) !== exerciseName) return
    const date = wMap[s.sessionId]
    if (!date || estimate1RM(s.weight, s.reps) <= 0) return
    if (!latest || date > latest) latest = date
  })
  return latest
}

// 某动作近 n 天的估算 1RM 趋势。endDate 可指定窗口终点
// 返回 [{dateStr, day, value}]，无数据日 value 为 null（折线图断点）
function oneRMTrend(workouts, sets, exerciseName, n, endDate) {
  const dates = lastNDates(n, endDate || latestExerciseDate(workouts, sets, exerciseName))
  const wMap = workoutDateMap(workouts)
  const namesById = exerciseNameMap(workouts)
  const best = {}
  ;(sets || []).forEach((s) => {
    if (s.completed === false) return
    if (resolveExerciseName(s, namesById) !== exerciseName) return
    const ds = wMap[s.sessionId]
    if (!ds) return
    const v = estimate1RM(s.weight, s.reps)
    if (v > 0 && (!best[ds] || v > best[ds])) best[ds] = v
  })
  return dates.map((ds) => ({
    dateStr: ds,
    day: Number(ds.slice(8, 10)),
    value: best[ds] != null ? best[ds] : null
  }))
}

// 连续打卡周数：从本周往前数，每周至少有 1 天训练即连续
// trainedDates: ['2026-08-02', ...]（dateStr 数组，无序亦可）
function weekStreak(trainedDates) {
  const set = new Set(trainedDates || [])
  if (!set.size) return 0
  const trainedWeek = (offset) => {
    // offset=0 本周，1 上周……（周一为一周起点）
    const today = dateUtil.todayString()
    const todayDate = dateUtil.parseDateString(today)
    const dow = (todayDate.getUTCDay() + 6) % 7 // 周一=0
    const monday = dateUtil.addDaysString(today, -dow - offset * 7)
    for (let i = 0; i < 7; i++) {
      const current = dateUtil.addDaysString(monday, i)
      if (current > today) break
      if (set.has(current)) return true
    }
    return false
  }
  let streak = 0
  // 本周还没练：不断签，从上周开始数（给用户留到周日的机会）
  const startOffset = trainedWeek(0) ? 0 : 1
  for (let o = startOffset; o < 520; o++) {
    if (trainedWeek(o)) streak++
    else break
  }
  return streak
}

module.exports = { fmtDate, lastNDates, volumeOf, aggregate, volumeTrend, buildCalendar, bodyTrend, estimate1RM, latestExerciseDate, oneRMTrend, weekStreak }
