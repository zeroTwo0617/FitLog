// 后端接入：图片 / agent 统一从这里走后端（Spring Boot 服务）。
// 域名为空时自动回退到本地 GIF（旧行为），保证开发期无后端也有图。
const config = require('./config.js')
const { gifForId } = require('../data/exercise-gif-map.js')

const BACKEND_BASE = (config.BACKEND_BASE || config.BACKEND_URL || '').replace(/\/+$/, '')
const TOKEN_KEY = config.BACKEND_TOKEN_KEY || 'fitlog_backend_jwt'
const PLACEHOLDER = config.BACKEND_PLACEHOLDER || ''

function enabled() {
  return !!BACKEND_BASE
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token) {
  if (token) wx.setStorageSync(TOKEN_KEY, token)
  return token
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY)
}

function request(options) {
  return new Promise((resolve, reject) => {
    if (!enabled()) return reject(new Error('后端地址未配置'))
    const header = Object.assign({}, options.header || {})
    const token = getToken()
    if (token) header.Authorization = 'Bearer ' + token
    wx.request(Object.assign({}, options, {
      url: BACKEND_BASE + (options.path || options.url || ''),
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res)
        const err = new Error((res.data && (res.data.msg || res.data.message)) || '后端请求失败')
        err.statusCode = res.statusCode
        reject(err)
      },
      fail: reject
    }))
  })
}

function login(code) {
  if (!enabled()) return Promise.reject(new Error('后端地址未配置'))
  if (!code) return Promise.reject(new Error('微信登录凭证为空'))
  return request({ path: '/api/auth/wx-login', method: 'POST', data: { code } })
    .then((res) => {
      const token = res.data && res.data.token
      if (!token) throw new Error('后端登录未返回 token')
      setToken(token)
      return res.data
    })
}

function backendLogin() {
  return new Promise((resolve, reject) => {
    if (!enabled()) return reject(new Error('后端地址未配置'))
    wx.login({
      success: (loginRes) => login(loginRes.code).then(resolve).catch(reject),
      fail: reject
    })
  })
}

function buildAgentContext() {
  const cloud = require('./cloud.js')
  const db = cloud.db()
  return Promise.all([
    db.collection(cloud.C.WORKOUTS).orderBy('dateStr', 'desc').limit(10).get(),
    db.collection(cloud.C.PLANS).limit(10).get(),
    db.collection(cloud.C.BODY).orderBy('date', 'desc').limit(3).get()
  ]).then(([workouts, plans, body]) => ({
    recentWorkouts: (workouts.data || []).map((item) => ({
      date: item.dateStr, title: item.title || '', exercises: (item.exercises || item.items || []).slice(0, 12)
    })),
    existingPlans: (plans.data || []).map((item) => ({
      name: item.name || '', items: (item.items || []).slice(0, 12)
    })),
    bodyMetrics: (body.data || []).map((item) => ({ date: item.date, weight: item.weight, bodyFat: item.bodyFat }))
  }))
}

function parseSseBuffer(buffer, onEvent) {
  const blocks = buffer.split(/\r?\n\r?\n/)
  const remainder = blocks.pop() || ''
  blocks.forEach((block) => {
    const event = (block.match(/^event:\s*(.+)$/m) || [])[1]
    const data = (block.match(/^data:\s*(.+)$/m) || [])[1]
    if (event && data) {
      try { onEvent(event, JSON.parse(data)) } catch (e) { onEvent(event, { raw: data }) }
    }
  })
  return remainder
}

function streamAgent(payload, handlers) {
  if (!enabled()) {
    if (handlers && handlers.onError) handlers.onError(new Error('后端地址未配置'))
    return { abort() {} }
  }
  const token = getToken()
  const task = wx.request({
    url: BACKEND_BASE + '/api/agent/stream', method: 'POST', data: payload,
    enableChunked: true, timeout: 60000,
    header: { 'content-type': 'application/json', Accept: 'text/event-stream', Authorization: 'Bearer ' + token },
    success: (res) => {
      if (res.statusCode === 401 && handlers.onAuthError) handlers.onAuthError()
      else if (res.statusCode >= 400 && handlers.onError) handlers.onError(new Error('Agent 请求失败'))
    },
    fail: (err) => handlers.onError && handlers.onError(err)
  })
  let buffer = ''
  if (task && task.onChunkReceived) task.onChunkReceived((chunk) => {
    const data = chunk && chunk.data
    if (typeof data === 'string') buffer += data
    else if (data) buffer += String.fromCharCode.apply(null, new Uint8Array(data))
    buffer = parseSseBuffer(buffer, (event, value) => handlers.onEvent && handlers.onEvent(event, value))
  })
  return task
}

// 相对地址补成绝对地址（小程序需要完整 URL）
function abs(url) {
  if (!url) return url
  if (url.indexOf('http') === 0) return url
  return BACKEND_BASE + url
}

// 未配置后端域名：回退本地 GIF 映射
function localMap(ids) {
  const map = {}
  ids.forEach((id) => {
    const src = gifForId(id)
    if (src) map[id] = { available: true, url: src, placeholder: PLACEHOLDER }
  })
  return map
}

// 批量拿图片映射：id -> { available, url, placeholder }
function getExerciseMediaMap(ids) {
  return new Promise((resolve) => {
    if (!ids || !ids.length) return resolve({})
    if (!BACKEND_BASE) return resolve(localMap(ids))
    wx.request({
      url: BACKEND_BASE + '/api/media/map?ids=' + ids.join(','),
      timeout: 8000,
      success: (res) => resolve(res.statusCode === 200 && res.data ? res.data : {}),
      fail: () => resolve({})
    })
  })
}

// 单个动作图片
function getExerciseMedia(id) {
  return new Promise((resolve) => {
    if (!id) return resolve({})
    if (!BACKEND_BASE) return resolve({ available: true, url: gifForId(id), placeholder: PLACEHOLDER })
    wx.request({
      url: BACKEND_BASE + '/api/media/exercise/' + encodeURIComponent(id),
      timeout: 8000,
      success: (res) => resolve(res.statusCode === 200 && res.data ? res.data : {}),
      fail: () => resolve({})
    })
  })
}

module.exports = {
  enabled,
  getToken,
  setToken,
  clearToken,
  login,
  getExerciseMediaMap,
  getExerciseMedia,
  abs,
  request,
  backendLogin,
  buildAgentContext,
  streamAgent
}
