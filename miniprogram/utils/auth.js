// 登录态与用户档案（云端 users 集合）
// 采用「微信云开发免登录模式」：记录由云环境自动注入 _openid，
// 配合集合权限「仅创建者可读写」，天然实现仅本人可见，无需自建 openid 传递/云函数。
const cloud = require('./cloud.js')
const userRepo = require('./repositories/user.js')

const STORAGE_KEY = 'fitlog_login_flag'

function isLoggedIn() {
  return !!wx.getStorageSync(STORAGE_KEY)
}

// 触发微信登录：获取 login code 并建立基础登录态标记。
// 真实 AppID 下 code 为有效凭证；游客模式会得到测试 code（无法连真云）。
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        wx.setStorageSync(STORAGE_KEY, true)
        resolve(res.code)
      },
      fail: reject
    })
  })
}

// 确保当前用户存在一条档案；由云函数用确定性文档 ID 幂等创建。
function ensureUser() {
  return login().then(() => userRepo.ensure()).then((res) => {
    const result = res && res.result ? res.result : res
    if (!result || !result.ok) throw new Error((result && result.message) || '用户档案初始化失败')
    return { profile: result.profile || null, created: !!result.created }
  })
}

// 更新最近活跃时间（写入时由云自动带 _openid，无需显式传）
function updateActive() {
  return login().then(() => userRepo.ensure()).then(() => userRepo.updateActive())
}

module.exports = { isLoggedIn, login, ensureUser, updateActive, STORAGE_KEY }
