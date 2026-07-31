const cloud = require('../../utils/cloud.js')
const hd = require('../../utils/historyData.js')

Page({
  data: {
    list: [],
    loading: true,
    trainedDays: 0,
    totalSets: 0,
    latestDate: ''
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    this.load()
  },

  load() {
    this.setData({ loading: true })
    const db = cloud.db()
    db.collection(cloud.C.WORKOUTS).limit(100).get()
      .then((res) => {
        const list = hd.sortWorkouts(res.data || []).map((w) => {
          const names = (w.exercises || []).map(e => e.name || '')
          const shown = names.slice(0, 3).join('、')
          const extra = names.length > 3 ? (' 等' + names.length + '项') : ''
          return Object.assign({}, w, { namesText: shown + extra })
        })
        const dates = {}
        list.forEach((item) => { if (item.dateStr) dates[item.dateStr] = true })
        this.setData({
          list,
          loading: false,
          trainedDays: Object.keys(dates).length,
          totalSets: list.reduce((sum, item) => sum + (Number(item.setTotal) || 0), 0),
          latestDate: list.length ? list[0].dateStr : ''
        })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载训练历史失败', err)
      })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/history-detail/history-detail?id=' + id })
  }
})
