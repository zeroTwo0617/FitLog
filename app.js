const config = require('./utils/config.js')
const theme = require('./utils/theme.js')

// 全局包装 Page：每个页面 onShow 时自动同步原生顶栏颜色，使顶栏跟随主题
// （避免逐个页面手动调用 wx.setNavigationBarColor）
const _Page = Page
Page = function (options) {
  const onShow = options.onShow
  options.onShow = function (...args) {
    const g = getApp()
    const t = (g && g.globalData && g.globalData.theme) || 'dark'
    theme.syncNavBar(t)
    if (typeof onShow === 'function') return onShow.apply(this, args)
  }
  return _Page(options)
}

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
