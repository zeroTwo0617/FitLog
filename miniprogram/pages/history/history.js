const cloud = require('../../utils/cloud.js')
const hd = require('../../utils/historyData.js')
const workoutData = require('../../utils/workoutData.js')
const page = require('../../utils/page.js')
const workoutRepo = require('../../utils/repositories/workout.js')

page({
  data: {
    list: [],
    loading: true,
    trainedDays: 0,
    totalSets: 0,
    latestDate: ''
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.load()
  },

  load() {
    this.setData({ loading: true })
    let request
    try {
      request = workoutRepo.listAll()
    } catch (err) {
      this.handleLoadError(err)
      return
    }
    request
      .then((rows) => {
        const list = hd.sortWorkouts(rows || []).map((w) => {
          const names = (w.exercises || []).map(e => e.name || '')
          const shown = names.slice(0, 3).join('、')
          const extra = names.length > 3 ? (' 等' + names.length + '项') : ''
          return Object.assign({}, w, { dateStr: workoutData.dateKey(w), namesText: shown + extra })
        })
        const dates = {}
        list.forEach((item) => { const date = workoutData.dateKey(item); if (date) dates[date] = true })
        this.setData({
          list,
          loading: false,
          trainedDays: Object.keys(dates).length,
          totalSets: list.reduce((sum, item) => sum + (Number(item.setTotal) || 0), 0),
          latestDate: list.length ? workoutData.dateKey(list[0]) : ''
        })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载训练历史失败', err)
      })
  },

  handleLoadError(err) {
    this.setData({ loading: false })
    wx.showToast({ title: '云服务暂不可用', icon: 'none' })
    console.error('加载训练历史失败', err)
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/history-detail/history-detail?id=' + id })
  }
})
