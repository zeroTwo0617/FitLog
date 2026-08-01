const cloud = require('../../utils/cloud.js')
const nutrition = require('../../utils/nutrition.js')

function formatToday() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return `${month}月${day}日 ${weekday}`
}

function buildFallback() {
  return {
    stats: [
      { label: '训练记录', value: '0', note: '还没开始' },
      { label: '训练计划', value: '0', note: '先建一个模板' },
      { label: '近7天', value: '0', note: '保持节奏' }
    ],
    recentPlans: [],
    todayNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 },
    todayNutritionText: '还没有饮食记录',
    todayNutritionMeta: '点击记录，热量会按宏量营养素自动换算',
    heroNote: '把训练记录、计划和进展放在一个地方。'
  }
}

Page({
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

  loadDashboard() {
    this.setData({ loading: true })
    const db = cloud.db()
    Promise.all([
      db.collection(cloud.C.WORKOUTS).count(),
      db.collection(cloud.C.PLANS).count(),
      db.collection(cloud.C.WORKOUTS).orderBy('dateStr', 'desc').limit(30).get(),
      db.collection(cloud.C.PLANS).limit(3).get(),
      db.collection(cloud.C.NUTRITION_LOGS).where({ dateStr: nutrition.today() }).get().catch(() => ({ data: [] }))
    ]).then(([workoutCountRes, planCountRes, workoutListRes, plansRes, nutritionRes]) => {
      const workouts = (workoutListRes && workoutListRes.data) || []
      const todayNutrition = nutrition.aggregateByDate((nutritionRes && nutritionRes.data) || [])[nutrition.today()] || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        mealCount: 0
      }
      const plans = ((plansRes && plansRes.data) || []).map((item) => {
        const items = Array.isArray(item.items) ? item.items : []
        return {
          _id: item._id,
          name: item.name || '未命名计划',
          count: items.length,
          preview: items.slice(0, 2).map((it) => it.exerciseName).join(' / ') || '先去补充动作'
        }
      })
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      const weekCount = workouts.filter((w) => {
        if (!w.dateStr) return false
        return new Date(w.dateStr).getTime() >= sevenDaysAgo.getTime()
      }).length
      const latest = workouts[0]
      const todayNutritionText = todayNutrition.mealCount > 0
        ? `${todayNutrition.calories} kcal · ${todayNutrition.mealCount} 餐已记录`
        : '还没有饮食记录'
      const todayNutritionMeta = todayNutrition.mealCount > 0
        ? `蛋白质 ${todayNutrition.protein}g · 碳水 ${todayNutrition.carbs}g · 脂肪 ${todayNutrition.fat}g`
        : '点击记录，热量会按宏量营养素自动换算'
      const heroNote = latest && latest.dateStr
        ? `最近一次训练在 ${latest.dateStr}，继续把节奏接上。`
        : '把训练记录、计划和进展放在一个地方。'
      this.setData({
        loading: false,
        heroNote,
        todayNutrition,
        todayNutritionText,
        todayNutritionMeta,
        recentPlans: plans,
        stats: [
          {
            label: '训练记录',
            value: String((workoutCountRes && workoutCountRes.total) || 0),
            note: latest && latest.dateStr ? `最近 ${latest.dateStr}` : '还没开始'
          },
          {
            label: '训练计划',
            value: String((planCountRes && planCountRes.total) || 0),
            note: plans.length > 0 ? '常用模板已就位' : '先建一个模板'
          },
          {
            label: '近7天',
            value: String(weekCount),
            note: weekCount > 0 ? '训练在推进' : '这一周还没打卡'
          }
        ]
      })
    }).catch((err) => {
      console.error('首页仪表盘加载失败', err)
      this.setData(Object.assign({ loading: false }, buildFallback()))
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

  openPlan(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/plan-detail/plan-detail?id=${id}` })
  }
})
