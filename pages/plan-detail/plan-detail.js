const cloud = require('../../utils/cloud.js')

Page({
  data: {
    id: '',
    plan: null,
    loading: true
  },
  onLoad(options) {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
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
  },
  // ===== 删除计划：确认弹窗 → 云端删除 → 返回列表（列表 onShow 自动刷新） =====
  deletePlan() {
    const plan = this.data.plan
    if (!plan) return
    wx.showModal({
      title: '删除计划',
      content: `确定删除「${plan.name}」吗？已完成的训练记录不受影响。`,
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中…', mask: true })
        cloud.db().collection(cloud.C.PLANS).doc(this.data.id).remove()
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 600)
          })
          .catch((err) => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
            console.error('删除计划失败', err)
          })
      }
    })
  }
})
