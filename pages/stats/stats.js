const cloud = require('../../utils/cloud.js')
const sd = require('../../utils/statsData.js')

Page({
  data: {
    loading: true,
    hasData: false,
    totalWorkouts: 0,
    totalVolume: 0,
    monthCheckins: 0,
    trend: [],
    maxByExercise: [],
    calendar: []
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    this.load()
  },

  load() {
    this.setData({ loading: true })
    const db = cloud.db()
    Promise.all([
      db.collection(cloud.C.WORKOUTS).limit(200).get(),
      db.collection(cloud.C.SETS).limit(1000).get()
    ]).then(([wRes, sRes]) => {
      const workouts = (wRes && wRes.data) || []
      const sets = (sRes && sRes.data) || []
      const agg = sd.aggregate(workouts, sets)

      // 近 14 天训练量趋势
      const trend = sd.volumeTrend(agg, 14)

      // 本月打卡天数
      const now = new Date()
      const ny = now.getFullYear()
      const nm = now.getMonth() + 1
      const prefix = ny + '-' + (nm < 10 ? '0' + nm : nm) + '-'
      const monthCheckins = agg.trainedDates.filter((d) => d.indexOf(prefix) === 0).length
      const calendar = sd.buildCalendar(ny, nm, agg.trainedDates)

      // 动作最大重量 Top5（带高度百分比）
      const maxW = agg.maxByExercise.length ? agg.maxByExercise[0].max : 0
      const maxByExercise = agg.maxByExercise.map((e) => Object.assign({}, e, {
        heightPct: maxW > 0 ? Math.round((e.max / maxW) * 100) : 0
      }))

      this.setData({
        loading: false,
        hasData: agg.totalWorkouts > 0,
        totalWorkouts: agg.totalWorkouts,
        totalVolume: agg.totalVolume,
        monthCheckins: monthCheckins,
        trend: trend,
        maxByExercise: maxByExercise,
        calendar: calendar
      })
    }).catch((err) => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error('加载统计失败', err)
    })
  },

  goBody() {
    wx.navigateTo({ url: '/pages/body/body' })
  }
})
