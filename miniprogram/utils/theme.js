// 主题管理：light / dark
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
  return s === 'light' || s === 'dark' ? s : 'light'
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

function findTabBar(pages) {
  const stack = Array.isArray(pages) ? pages : []
  for (let i = stack.length - 1; i >= 0; i--) {
    const page = stack[i]
    if (!page || typeof page.getTabBar !== 'function') continue
    const tabBar = page.getTabBar()
    if (tabBar && typeof tabBar.setData === 'function') return tabBar
  }
  return null
}

function setTheme(t) {
  if (t !== 'light' && t !== 'dark') return
  wx.setStorageSync(KEY, t)
  const app = getApp()
  if (app && app.globalData) app.globalData.theme = t
  // 只更新当前可见页；隐藏页会在 onShow 时读取 globalData，避免大页面同时重绘。
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const current = pages[pages.length - 1]
  if (current && typeof current.setData === 'function') current.setData({ theme: t })
  // 设置页不是 tab 页面，从页面栈中寻找仍存活的自定义底部导航实例。
  const tabBar = findTabBar(pages)
  if (tabBar) tabBar.setData({ theme: t })
  // 立即同步当前可见页的顶栏颜色
  syncNavBar(t)
}

function toggle() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

module.exports = { getTheme, setTheme, toggle, syncNavBar }
