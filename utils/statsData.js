// 统计 / 日历 / 身体数据 纯函数（不依赖 wx，便于单测）
// 对齐 开发文档.md §5.2 workouts / §5.3 sets / §5.5 body_records / §5.7 打卡日历

function fmtDate(d) {
  const p = (x) => (x < 10 ? '0' + x : '' + x)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// 返回最近 n 天的 dateStr 数组（含今天），升序
function lastNDates(n, endDate) {
  const end = endDate ? new Date(endDate) : new Date()
  const arr = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    arr.push(fmtDate(d))
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

// 聚合：训练量、动作最大重量、打卡日
// workouts: [{_id, dateStr, ...}]；sets: [{sessionId, exerciseId, exerciseName, reps, weight, ...}]
function aggregate(workouts, sets) {
  const wMap = {}
  ;(workouts || []).forEach((w) => {
    if (w && w._id) wMap[w._id] = w.dateStr
  })

  const byDateMap = {}
  const dayEx = {}
  const exMax = {}
  const trainedSet = {}
  let totalVolume = 0

  ;(sets || []).forEach((s) => {
    if (s.completed === false) return // 未勾完成的组不计入统计（旧数据无该字段，不受影响）
    const dateStr = wMap[s.sessionId]
    if (!dateStr) return
    const vol = volumeOf(s)
    totalVolume += vol
    if (!byDateMap[dateStr]) byDateMap[dateStr] = { dateStr, volume: 0, setsCount: 0, exerciseCount: 0 }
    byDateMap[dateStr].volume += vol
    byDateMap[dateStr].setsCount += 1
    trainedSet[dateStr] = true
    if (!dayEx[dateStr]) dayEx[dateStr] = {}
    dayEx[dateStr][s.exerciseId || s.exerciseName] = true
    const w = Number(s.weight)
    if (w > 0 && s.exerciseName) {
      if (!exMax[s.exerciseName] || w > exMax[s.exerciseName]) exMax[s.exerciseName] = w
    }
  })

  Object.keys(dayEx).forEach((d) => {
    if (byDateMap[d]) byDateMap[d].exerciseCount = Object.keys(dayEx[d]).length
  })

  const byDate = Object.keys(byDateMap)
    .map((k) => byDateMap[k])
    .sort((a, b) => (a.dateStr < b.dateStr ? -1 : 1))

  const maxByExercise = Object.keys(exMax)
    .map((name) => ({ name, max: exMax[name] }))
    .sort((a, b) => b.max - a.max)
    .slice(0, 5)

  const totalWorkouts = (workouts || []).length
  const trainedDates = Object.keys(trainedSet).sort()
  return { totalWorkouts, totalVolume, byDate, maxByExercise, trainedDates }
}

// 近 n 天训练量趋势（用于柱状图）。返回 [{dateStr, day, volume, heightPct, trained}]
function volumeTrend(agg, n) {
  const dates = lastNDates(n)
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
  const first = new Date(year, month - 1, 1)
  const startWeekday = first.getDay() // 0=周日
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayStr = fmtDate(new Date())
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

// 某动作近 n 天的估算 1RM 趋势。返回 [{dateStr, day, value}]，无数据日 value 为 null（折线图断点）
function oneRMTrend(workouts, sets, exerciseName, n) {
  const dates = lastNDates(n)
  const wMap = {}
  ;(workouts || []).forEach((w) => {
    if (w && w._id) wMap[w._id] = w.dateStr
  })
  const best = {}
  ;(sets || []).forEach((s) => {
    if (s.completed === false) return
    if (s.exerciseName !== exerciseName) return
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
    const now = new Date()
    const monday = new Date(now)
    const dow = (now.getDay() + 6) % 7 // 周一=0
    monday.setDate(now.getDate() - dow - offset * 7)
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      if (d.getTime() > now.getTime()) break
      if (set.has(fmtDate(d))) return true
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

module.exports = { fmtDate, lastNDates, volumeOf, aggregate, volumeTrend, buildCalendar, bodyTrend, estimate1RM, oneRMTrend, weekStreak }
