// 主题管理：dark / light
// - 持久化到本地存储，下次启动沿用
// - 切换时通过 getCurrentPages() 广播给所有已打开页面，立即生效
const KEY = 'fitlog_theme'

// 顶栏（原生 navigationBar）跟随主题的颜色配置
const NAV = {
  dark:  { frontColor: '#ffffff', backgroundColor: '#0f1115' },
  light: { frontColor: '#000000', backgroundColor: '#f3f5fa' }
}

function getTheme() {
  const s = wx.getStorageSync(KEY)
  return s === 'light' || s === 'dark' ? s : 'dark'
}

// 同步原生顶栏颜色（frontColor 仅支持 #ffffff / #000000）
function syncNavBar(t) {
  const cfg = NAV[t] || NAV.dark
  wx.setNavigationBarColor({
    frontColor: cfg.frontColor,
    backgroundColor: cfg.backgroundColor,
    animation: { duration: 200, timingFunc: 'ease' }
  })
}

function setTheme(t) {
  if (t !== 'light' && t !== 'dark') return
  wx.setStorageSync(KEY, t)
  const app = getApp()
  if (app && app.globalData) app.globalData.theme = t
  // 广播给当前页面栈，立即生效
  const pages = getCurrentPages()
  pages.forEach((p) => {
    if (p && typeof p.setData === 'function') p.setData({ theme: t })
  })
  // 立即同步当前可见页的顶栏颜色
  syncNavBar(t)
}

function toggle() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

module.exports = { getTheme, setTheme, toggle, syncNavBar }
