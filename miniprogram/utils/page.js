// 页面注册封装：集中处理原生导航栏同步，避免覆盖全局 Page。
const theme = require('./theme.js')

function registerPage(options) {
  const originalOnShow = options.onShow
  options.onShow = function () {
    const app = getApp()
    theme.syncNavBar((app && app.globalData && app.globalData.theme) || 'dark')
    if (typeof originalOnShow === 'function') return originalOnShow.apply(this, arguments)
  }
  return Page(options)
}

module.exports = registerPage
