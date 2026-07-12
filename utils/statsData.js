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

module.exports = { fmtDate, lastNDates, volumeOf, aggregate, volumeTrend, buildCalendar, bodyTrend }
