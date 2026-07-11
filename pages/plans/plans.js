const cloud = require('../../utils/cloud.js')
const pd = require('../../utils/planData.js')

Page({
  data: {
    list: [],
    loading: true
  },
  onShow() {
    this.load()
  },
  load() {
    this.setData({ loading: true })
    const db = cloud.db()
    // 权限「仅创建者可读写」会自动按 _openid 过滤，无需 where
    db.collection(cloud.C.PLANS).limit(100).get()
      .then((res) => {
        const raw = (res && res.data) || []
        const list = raw.map((p) => {
          const s = pd.planSummary(p)
          return Object.assign({}, p, { count: s.count, namesText: s.namesText })
        })
        this.setData({ list, loading: false })
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
