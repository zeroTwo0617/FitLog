const cloud = require('../../utils/cloud.js')
const nutrition = require('../../utils/nutrition.js')
const workoutData = require('../../utils/workoutData.js')
const page = require('../../utils/page.js')
const workoutRepo = require('../../utils/repositories/workout.js')
const planRepo = require('../../utils/repositories/plan.js')
const nutritionRepo = require('../../utils/repositories/nutrition.js')
const bodyRepo = require('../../utils/repositories/body.js')

function formatToday() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return `${month}月${day}日 ${weekday}`
}

function fmtDate(d) {
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// 近 7 天打卡条：[{dateStr, label, trained, isToday}]，最右为今天
function buildWeekDays(workouts) {
  const trained = workoutData.summarize(workouts).trainedDates.reduce((map, date) => {
    map[date] = true
    return map
  }, {})
  const labels = ['日', '一', '二', '三', '四', '五', '六']
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = fmtDate(d)
    days.push({ dateStr: ds, label: labels[d.getDay()], trained: !!trained[ds], isToday: i === 0 })
  }
  return days
}

function numberValue(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function formatKcal(value) {
  return value == null ? '--' : String(Math.max(0, Math.round(value)))
}

function estimateBmr(body) {
  const weight = numberValue(body && body.weight)
  if (weight <= 0) return null
  const bodyFat = numberValue(body && (body.bodyFat || body.fatPct))
  if (bodyFat > 0 && bodyFat < 80) {
    return 370 + (21.6 * weight * (1 - bodyFat / 100))
  }
  // 当前身体数据页至少收集体重，缺少年龄/性别时按体重给出保守估算。
  return 22 * weight
}

function workoutSetCount(workout) {
  if (numberValue(workout && workout.setTotal) > 0) return numberValue(workout.setTotal)
  return (Array.isArray(workout && workout.exercises) ? workout.exercises : [])
    .reduce((sum, item) => sum + (Array.isArray(item && item.sets) ? item.sets.length : 0), 0)
}

function estimateWorkoutCalories(workout, weight) {
  const direct = numberValue(workout && (workout.calories || workout.calorieBurn || workout.exerciseCalories))
  if (direct > 0) return direct
  const duration = numberValue(workout && (workout.durationMinutes || workout.duration))
  if (duration > 0 && weight > 0) {
    // 力量训练按约 6 MET 估算；仅供记录参考，不作为医疗建议。
    return 6 * 3.5 * weight / 200 * duration
  }
  const sets = workoutSetCount(workout)
  return sets > 0 ? sets * 8 : (Array.isArray(workout && workout.exercises) ? workout.exercises.length * 24 : 0)
}

function buildEnergySummary(body, workouts) {
  const weight = numberValue(body && body.weight)
  const today = nutrition.today()
  const exercise = (workouts || [])
    .filter((item) => workoutData.dateKey(item) === today)
    .reduce((sum, item) => sum + estimateWorkoutCalories(item, weight), 0)
  const bmr = estimateBmr(body)
  return {
    bmr: formatKcal(bmr),
    exercise: formatKcal(exercise),
    total: formatKcal(bmr == null ? null : bmr + exercise),
    note: bmr == null
      ? '补充身体数据后，可估算基础代谢与今日训练消耗。'
      : (body && (body.bodyFat || body.fatPct) ? '基础代谢 + 今日训练 · 估算值' : '按体重估算基础代谢 + 今日训练 · 估算值'),
    bodyNote: body && body.weight ? `已读取 ${body.weight} kg 身体数据` : '暂无身体数据'
  }
}

function buildProgressStyle(done) {
  const completed = Math.min(7, Math.max(0, Number(done) || 0))
  const angle = Math.round((completed / 7) * 36000) / 100
  return `background: conic-gradient(var(--primary) 0deg ${angle}deg, var(--hairline) ${angle}deg 360deg);`
}

function buildFallback() {
  return {
    stats: [
      { label: '训练记录', value: '0', note: '还没开始' },
      { label: '训练计划', value: '0', note: '先建一个模板' },
      { label: '近7天', value: '0', note: '保持节奏' }
    ],
    weekDays: [],
    weekDone: 0,
    progressStyle: buildProgressStyle(0),
    todayNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 },
    todayNutritionText: '还没有饮食记录',
    todayNutritionMeta: '点击记录，热量会按宏量营养素自动换算',
    energySummary: {
      bmr: '--',
      exercise: '0',
      total: '--',
      note: '补充身体数据后，可估算基础代谢与今日训练消耗。',
      bodyNote: '暂无身体数据'
    },
    heroNote: '把训练记录、计划和进展放在一个地方。'
  }
}

page({
  data: Object.assign({
    theme: 'light',
    todayText: formatToday(),
    loading: true
  }, buildFallback()),

  onShow() {
    this.setData({
      theme: getApp().globalData.theme || 'dark',
      todayText: formatToday()
    })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadDashboard()
  },

  onPullDownRefresh() {
    this.loadDashboard(() => wx.stopPullDownRefresh())
  },

  loadDashboard(callback) {
    this.setData({ loading: true })
    try {
      if (!cloud.isReady()) throw new Error('云环境未初始化')
    } catch (err) {
      console.error('首页云环境未就绪', err)
      this.setData(Object.assign({ loading: false }, buildFallback()))
      wx.showToast({ title: '云服务暂不可用', icon: 'none' })
      if (callback) callback()
      return
    }
    Promise.all([
      workoutRepo.count(),
      planRepo.count(),
      workoutRepo.listRecent(30).then((data) => ({ data: data })),
      nutritionRepo.listByDate(nutrition.today()).then((data) => ({ data: data })).catch(() => ({ data: [] })),
      bodyRepo.latest().then((data) => ({ data: data })).catch(() => ({ data: [] }))
    ]).then(([workoutCountRes, planCountRes, workoutListRes, nutritionRes, bodyRes]) => {
      const workouts = (workoutListRes && workoutListRes.data) || []
      const latestBody = bodyRes && bodyRes.data && bodyRes.data[0]
      const todayNutrition = nutrition.aggregateByDate((nutritionRes && nutritionRes.data) || [])[nutrition.today()] || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        mealCount: 0
      }
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setHours(0, 0, 0, 0)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      const weekDates = workouts.filter((w) => {
        const date = workoutData.dateKey(w)
        return date && new Date(date).getTime() >= sevenDaysAgo.getTime()
      }).map((w) => workoutData.dateKey(w)).filter(Boolean)
      const weekCount = Array.from(new Set(weekDates)).length
      const latest = workouts[0]
      const latestDate = workoutData.dateKey(latest)
      const todayNutritionText = todayNutrition.mealCount > 0
        ? `${todayNutrition.calories} kcal · ${todayNutrition.mealCount} 餐已记录`
        : '还没有饮食记录'
      const todayNutritionMeta = todayNutrition.mealCount > 0
        ? `蛋白质 ${todayNutrition.protein}g · 碳水 ${todayNutrition.carbs}g · 脂肪 ${todayNutrition.fat}g`
        : '点击记录，热量会按宏量营养素自动换算'
      const heroNote = latestDate
        ? `最近一次训练在 ${latestDate}，继续把节奏接上。`
        : '把训练记录、计划和进展放在一个地方。'
      const weekDays = buildWeekDays(workouts)
      const weekDone = weekDays.filter((d) => d.trained).length
      this.setData({
        loading: false,
        heroNote,
        todayNutrition,
        todayNutritionText,
        todayNutritionMeta,
        energySummary: buildEnergySummary(latestBody, workouts),
        weekDays: weekDays,
        weekDone: weekDone,
        progressStyle: buildProgressStyle(weekDone),
        stats: [
          {
            label: '训练记录',
            value: String((workoutCountRes && workoutCountRes.total) || 0),
            note: latestDate ? `最近 ${latestDate}` : '还没开始'
          },
          {
            label: '训练计划',
            value: String((planCountRes && planCountRes.total) || 0),
            note: (planCountRes && planCountRes.total) > 0 ? '常用模板已就位' : '先建一个模板'
          },
          {
            label: '近7天',
            value: String(weekCount),
            note: weekCount > 0 ? '训练在推进' : '这一周还没打卡'
          }
        ]
      })
      if (callback) callback()
    }).catch((err) => {
      console.error('首页仪表盘加载失败', err)
      this.setData(Object.assign({ loading: false }, buildFallback()))
      wx.showToast({ title: '数据加载失败，请重试', icon: 'none' })
      if (callback) callback()
    })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  goPlans() {
    wx.navigateTo({ url: '/pages/plans/plans' })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goStats() {
    wx.navigateTo({ url: '/pages/stats/stats' })
  },

  goNutrition() {
    wx.navigateTo({ url: `/pages/nutrition/nutrition?date=${nutrition.today()}` })
  },

  goBody() {
    wx.navigateTo({ url: '/pages/body/body' })
  },

  goAgent() {
    wx.switchTab({ url: '/pages/agent/agent' })
  },

})
