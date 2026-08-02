const config = require('./utils/config.js')
const theme = require('./utils/theme.js')

App({
  globalData: {
    theme: 'dark',
    cloudReady: false
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库不支持云开发，请使用 2.2.3 或以上版本')
      return
    }
    wx.cloud.init({
      env: config.CLOUD_ENV,
      traceUser: true
    })
    this.globalData.cloudReady = true
    // 启动时读取已保存的主题
    this.globalData.theme = theme.getTheme()
  }
})
