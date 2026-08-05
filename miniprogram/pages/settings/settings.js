const auth = require('../../utils/auth.js')
const page = require('../../utils/page.js')
const systemRepo = require('../../utils/repositories/system.js')
const agentApi = require('../../utils/agentApi.js')
const theme = require('../../utils/theme.js')

page({
  data: {
    theme: 'light',
    darkMode: false,
    deleting: false
  },

  onLoad() {
    this.syncTheme()
  },

  onShow() {
    this.syncTheme()
  },

  syncTheme() {
    const current = theme.getTheme()
    this.setData({ theme: current, darkMode: current === 'dark' })
  },

  toggleDarkTheme(e) {
    const next = e.detail.value ? 'dark' : 'light'
    theme.setTheme(next)
    this.setData({ theme: next, darkMode: next === 'dark' })
  },

  openLegal(e) {
    const type = e.currentTarget.dataset.type || 'privacy'
    wx.navigateTo({ url: `/pages/legal/legal?type=${type}` })
  },

  deleteUserData() {
    if (this.data.deleting) return
    wx.showModal({
      title: '删除全部数据？',
      content: '这会删除训练、计划、身体数据、饮食记录、教练会话和用户档案，删除后无法恢复。',
      confirmText: '继续删除',
      confirmColor: '#c9533d',
      success: (first) => {
        if (!first.confirm) return
        wx.showModal({
          title: '请再次确认',
          content: '确定要永久删除你的 FitLog 数据吗？',
          confirmText: '确认删除',
          confirmColor: '#c9533d',
          success: (second) => {
            if (second.confirm) this.performDelete()
          }
        })
      }
    })
  },

  performDelete() {
    this.setData({ deleting: true })
    auth.ensureUser()
      .then(() => systemRepo.deleteUserData())
      .then(() => {
        wx.removeStorageSync(auth.STORAGE_KEY)
        wx.removeStorageSync(agentApi.sessionKey('training'))
        wx.removeStorageSync(agentApi.sessionKey('diet'))
        wx.removeStorageSync('fitlog_agent_plan_draft')
        this.setData({ deleting: false })
        wx.showToast({ title: '数据已删除', icon: 'success' })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 700)
      })
      .catch((error) => {
        this.setData({ deleting: false })
        wx.showToast({ title: (error && error.message) || '删除失败，请稍后重试', icon: 'none' })
        console.error('删除用户数据失败', error)
      })
  }
})
