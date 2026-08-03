// 主题管理：dark / light
// - 持久化到本地存储，下次启动沿用
// - 切换时通过 getCurrentPages() 广播给所有已打开页面，立即生效
const KEY = 'fitlog_theme'

// 顶栏（原生 navigationBar）跟随主题的颜色配置
const NAV = {
  dark:  { frontColor: '#ffffff', backgroundColor: '#0a0c0b' },
  light: { frontColor: '#000000', backgroundColor: '#f6f7f2' }
}

function getTheme() {
  const s = wx.getStorageSync(KEY)
  return s === 'light' || s === 'dark' ? s : 'dark'
}

// 同步原生顶栏颜色（frontColor 仅支持 #ffffff / #000000）
// 每次 onShow 都强制设置，避免缓存跳过导致导航栏停留在旧主题（页面首次渲染用 app.json 配置）。
function syncNavBar(t) {
  const cfg = NAV[t] || NAV.dark
  if (!wx.setNavigationBarColor) return
  wx.setNavigationBarColor({
    frontColor: cfg.frontColor,
    backgroundColor: cfg.backgroundColor,
    animation: { duration: 0, timingFunc: 'linear' }
  })
}

function setTheme(t) {
  if (t !== 'light' && t !== 'dark') return
  wx.setStorageSync(KEY, t)
  const app = getApp()
  if (app && app.globalData) app.globalData.theme = t
  // 只更新当前可见页；隐藏页会在 onShow 时读取 globalData，避免大页面同时重绘。
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  if (current && typeof current.setData === 'function') current.setData({ theme: t })
  // 同步自定义底部导航（tab 栏是独立组件，不随页面 setData 刷新）
  const tabBar = current && typeof current.getTabBar === 'function' && current.getTabBar()
  if (tabBar && typeof tabBar.setData === 'function') tabBar.setData({ theme: t })
  // 立即同步当前可见页的顶栏颜色
  syncNavBar(t)
}

function toggle() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

module.exports = { getTheme, setTheme, toggle, syncNavBar }
