const cloud = require('../../utils/cloud.js')
const pd = require('../../utils/planData.js')
const page = require('../../utils/page.js')
const planRepo = require('../../utils/repositories/plan.js')

page({
  data: {
    theme: 'light',
    list: [],
    loading: true,
    totalExercises: 0
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    return this.load()
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh())
  },

  load(callback) {
    this.setData({ loading: true })
    let db
    try {
      db = null
    } catch (err) {
      console.error('计划页云环境未就绪', err)
      this.setData({ loading: false })
      wx.showToast({ title: '云服务暂不可用', icon: 'none' })
      if (callback) callback()
      return
    }
    return planRepo.list(100)
      .then((raw) => {
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
        if (callback) callback()
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载计划列表失败', err)
        if (callback) callback()
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
