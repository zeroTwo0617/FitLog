const config = require('./utils/config.js')
const theme = require('./utils/theme.js')

App({
  globalData: {
    theme: 'light',
    cloudReady: false
  },
  onLaunch() {
    this.registerPrivacyAuthorization()
    if (!wx.cloud) {
      console.error('当前基础库不支持云开发，请使用 2.2.3 或以上版本')
      return
    }
    try {
      wx.cloud.init({
        env: config.CLOUD_ENV,
        traceUser: true
      })
      this.globalData.cloudReady = true
    } catch (error) {
      this.globalData.cloudReady = false
      console.error('云环境初始化失败', error)
    }
    const savedTheme = theme.getTheme()
    this.globalData.theme = savedTheme
    theme.syncNavBar(savedTheme)
  },

  registerPrivacyAuthorization() {
    if (typeof wx.onNeedPrivacyAuthorization !== 'function') return
    this._privacyResolvers = []
    this._privacyPrompting = false
    wx.onNeedPrivacyAuthorization((resolve) => {
      if (typeof resolve !== 'function') return
      this._privacyResolvers.push(resolve)
      if (this._privacyPrompting) return
      this._privacyPrompting = true
      wx.showModal({
        title: '隐私保护提示',
        content: 'FitLog 会保存你主动填写的训练、身体和饮食数据；使用图片识别时会上传你选择的图片。请阅读隐私政策后再继续。',
        confirmText: '同意并继续',
        cancelText: '暂不使用',
        success: (result) => this.resolvePrivacy(result && result.confirm ? 'agree' : 'disagree'),
        fail: () => this.resolvePrivacy('disagree')
      })
    })
  },

  resolvePrivacy(event) {
    const resolvers = this._privacyResolvers || []
    this._privacyResolvers = []
    this._privacyPrompting = false
    resolvers.forEach((resolve) => {
      try {
        resolve({ event: event })
      } catch (error) {
        console.error('隐私授权回调处理失败', error)
      }
    })
  }
})
