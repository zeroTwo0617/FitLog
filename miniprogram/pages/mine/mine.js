const auth = require('../../utils/auth.js')
const nutrition = require('../../utils/nutrition.js')
const workoutData = require('../../utils/workoutData.js')
const page = require('../../utils/page.js')
const workoutRepo = require('../../utils/repositories/workout.js')
const planRepo = require('../../utils/repositories/plan.js')
const bodyRepo = require('../../utils/repositories/body.js')
const nutritionRepo = require('../../utils/repositories/nutrition.js')

page({
  data: {
    theme: 'light',
    profile: null,
    displayName: 'FitLog 用户',
    workoutCount: 0,
    planCount: 0,
    weekDone: 0,
    goalText: '未设置',
    levelText: '未设置',
    bodySummary: {
      weight: '--',
      bmi: '--',
      date: '暂无记录'
    },
    todayNutritionText: '今日暂无饮食记录'
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    this.refresh()
  },

  refresh() {
    Promise.all([
      auth.ensureUser(),
      workoutRepo.count(),
      planRepo.count(),
      bodyRepo.latest().then((data) => ({ data: data })).catch(() => ({ data: [] })),
      workoutRepo.listRecent(30).then((data) => ({ data: data })).catch(() => ({ data: [] })),
      nutritionRepo.listByDate(nutrition.today()).then((data) => ({ data: data })).catch(() => ({ data: [] }))
    ]).then(([u, workoutCnt, planCnt, bodyRes, workoutListRes, nutritionRes]) => {
      const profile = (u && u.profile) || {}
      const latestBody = bodyRes && bodyRes.data && bodyRes.data[0]
      const todayNutrition = nutrition.aggregateByDate((nutritionRes && nutritionRes.data) || [])[nutrition.today()]
      const height = latestBody && Number(latestBody.height) > 0 ? Number(latestBody.height) / 100 : 0
      const bmi = latestBody && Number(latestBody.weight) > 0 && height > 0
        ? (Number(latestBody.weight) / (height * height)).toFixed(1)
        : '--'
      // 本周打卡天数（近 7 天有训练记录的天数）
      const trainedSet = workoutData.summarize((workoutListRes && workoutListRes.data) || []).trainedDates.reduce((map, date) => {
        map[date] = true
        return map
      }, {})
      const p2 = (n) => (n < 10 ? '0' + n : '' + n)
      let weekDone = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        if (trainedSet[d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())]) weekDone++
      }
      this.setData({
        profile: profile,
        displayName: profile.nickName || 'FitLog 用户',
        workoutCount: (workoutCnt && workoutCnt.total) || 0,
        planCount: (planCnt && planCnt.total) || 0,
        weekDone: weekDone,
        goalText: profile.goal || profile.trainingGoal || '未设置',
        levelText: profile.level || profile.trainingLevel || '未设置',
        bodySummary: {
          weight: latestBody && latestBody.weight ? `${latestBody.weight} kg` : '--',
          bmi: bmi,
          date: latestBody && latestBody.dateStr ? latestBody.dateStr : '暂无记录'
        },
        todayNutritionText: todayNutrition && todayNutrition.mealCount
          ? `今日摄入 · ${todayNutrition.calories} kcal`
          : '今日暂无饮食记录'
      })
    }).catch((err) => {
      console.error('加载个人数据失败', err)
    })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goPlans() {
    wx.navigateTo({ url: '/pages/plans/plans' })
  },

  goStats() {
    wx.navigateTo({ url: '/pages/stats/stats' })
  },

  goBody() {
    wx.navigateTo({ url: '/pages/body/body' })
  },

  goNutrition() {
    wx.navigateTo({ url: `/pages/nutrition/nutrition?date=${nutrition.today()}` })
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  goAgent() {
    wx.switchTab({ url: '/pages/agent/agent' })
  },

})
