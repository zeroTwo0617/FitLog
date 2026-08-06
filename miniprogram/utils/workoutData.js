// 训练记录的唯一日期口径。
// workouts 是训练会话事实来源；sets 只补充容量、1RM 等明细指标。
const dateUtil = require('./date.js')

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function formatDate(date) {
  return dateUtil.dateString(date)
}

function dateKey(record) {
  if (!record) return ''
  if (record.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(record.dateStr))) return String(record.dateStr)
  const raw = record.date || record.createdAt
  if (!raw) return ''
  const date = raw instanceof Date ? raw : new Date(raw)
  return isNaN(date.getTime()) ? '' : formatDate(date)
}

function summarize(workouts) {
  const byDate = {}
  ;(workouts || []).forEach((workout) => {
    const date = dateKey(workout)
    if (!date) return
    if (!byDate[date]) byDate[date] = { dateStr: date, workoutCount: 0, exerciseCount: 0, setCount: 0 }
    byDate[date].workoutCount += 1
    byDate[date].exerciseCount += (workout.exercises || []).length
    byDate[date].setCount += Number(workout.setTotal) || 0
  })
  const dates = Object.keys(byDate).sort()
  return {
    totalWorkouts: (workouts || []).length,
    trainedDates: dates,
    byDate: byDate
  }
}

module.exports = { dateKey, formatDate, summarize }
