const auth = require('../../utils/auth.js')
const cloud = require('../../utils/cloud.js')
const config = require('../../utils/config.js')

Page({
  data: {
    cloud: { status: 'pending', text: '正在同步…' },
    profile: null,
    workoutCount: 0
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.refresh()
  },
  refresh() {
    this.setData({ 'cloud.status': 'pending', 'cloud.text': '正在同步…' })
    Promise.all([
      auth.ensureUser(),
      cloud.collection(cloud.C.WORKOUTS).count()
    ]).then(([u, cnt]) => {
      this.setData({
        profile: u.profile,
        'cloud.status': 'ok',
        'cloud.text': '云端已同步',
        workoutCount: (cnt && cnt.total) || 0
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
  }
})
