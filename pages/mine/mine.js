const auth = require('../../utils/auth.js')
const cloud = require('../../utils/cloud.js')
const theme = require('../../utils/theme.js')

Page({
  data: {
    theme: 'light',
    cloud: { status: 'pending', text: '正在同步...' },
    profile: null,
    displayName: 'FitLog 用户',
    workoutCount: 0,
    planCount: 0
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    this.refresh()
  },

  refresh() {
    this.setData({ 'cloud.status': 'pending', 'cloud.text': '正在同步...' })
    Promise.all([
      auth.ensureUser(),
      cloud.collection(cloud.C.WORKOUTS).count(),
      cloud.collection(cloud.C.PLANS).count()
    ]).then(([u, workoutCnt, planCnt]) => {
      this.setData({
        profile: u.profile,
        displayName: (u && u.profile && u.profile.nickName) || 'FitLog 用户',
        'cloud.status': 'ok',
        'cloud.text': '云端同步正常',
        workoutCount: (workoutCnt && workoutCnt.total) || 0,
        planCount: (planCnt && planCnt.total) || 0
      })
    }).catch((err) => {
      this.setData({
        'cloud.status': 'error',
        'cloud.text': '云端同步失败：' + ((err && err.errMsg) || '未知错误')
      })
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

  goAgent() {
    wx.switchTab({ url: '/pages/agent/agent' })
  },

  toggleTheme() {
    theme.toggle()
  }
})
