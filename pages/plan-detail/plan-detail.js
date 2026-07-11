const cloud = require('../../utils/cloud.js')

Page({
  data: {
    id: '',
    plan: null,
    loading: true
  },
  onLoad(options) {
    const id = options && options.id ? options.id : ''
    this.setData({ id })
    if (id) this.load(id)
  },
  load(id) {
    this.setData({ loading: true })
    const db = cloud.db()
    db.collection(cloud.C.PLANS).doc(id).get()
      .then((res) => {
        this.setData({ plan: (res && res.data) || null, loading: false })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载计划详情失败', err)
      })
  },
  startTraining() {
    wx.navigateTo({ url: '/pages/record/record?planId=' + this.data.id })
  }
})
