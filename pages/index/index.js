const ex = require('../../utils/exerciseData.js')
const auth = require('../../utils/auth.js')

function fmtDate(d) {
  if (!d) return ''
  const dt = (d instanceof Date) ? d : new Date(d)
  if (isNaN(dt.getTime())) return ''
  const p = (n) => (n < 10 ? '0' : '') + n
  return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate()) +
    ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes())
}

Page({
  data: {
    count: 0,
    cloud: { status: 'pending', text: '正在连接云端…', profileText: '' }
  },
  onLoad() {
    this.setData({ count: ex.PRESET.length })
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.syncCloud()
  },
  // 验证云端链路：登录 + 读写 users 集合
  syncCloud() {
    this.setData({ 'cloud.status': 'pending', 'cloud.text': '正在连接云端…', 'cloud.profileText': '' })
    auth.ensureUser()
      .then(({ profile, created }) => {
        auth.updateActive()
        this.setData({
          'cloud.status': 'ok',
          'cloud.text': created ? '云端已连接 · 已为你创建档案' : '云端已连接 · 数据已同步',
          'cloud.profileText': profile ? ('档案创建于 ' + fmtDate(profile.createdAt)) : ''
        })
      })
      .catch((err) => {
        const msg = err && err.errMsg ? err.errMsg : '未知错误'
        this.setData({
          'cloud.status': 'error',
          'cloud.text': '云端连接失败：' + msg
        })
      })
  },
  goExercises() {
    wx.switchTab({ url: '/pages/exercises/exercises' })
  },
  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },
  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  }
})
