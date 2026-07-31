const cloud = require('../../utils/cloud.js')
const pd = require('../../utils/planData.js')

Page({
  data: {
    theme: 'light',
    list: [],
    loading: true,
    totalExercises: 0
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    this.load()
  },

  load() {
    this.setData({ loading: true })
    const db = cloud.db()
    db.collection(cloud.C.PLANS).limit(100).get()
      .then((res) => {
        const raw = (res && res.data) || []
        const list = raw.map((p) => {
          const s = pd.planSummary(p)
          const items = Array.isArray(p.items) ? p.items : []
          const totalSets = items.reduce((sum, item) => sum + (Number(item.targetSets) || 0), 0)
          return Object.assign({}, p, {
            count: s.count,
            namesText: s.namesText,
            totalSets,
            previewNames: items.slice(0, 3).map((item) => item.exerciseName),
            moreCount: Math.max(0, items.length - 3)
          })
        })
        const totalExercises = list.reduce((sum, item) => sum + item.count, 0)
        this.setData({ list, totalExercises, loading: false })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载计划列表失败', err)
      })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/plan-detail/plan-detail?id=' + id })
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit' })
  }
})
