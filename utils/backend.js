// 后端接入：图片 / agent 统一从这里走后端（Spring Boot 服务）。
const config = require('./config.js')

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
      bodyMetrics: body.data && body.data[0]
        ? { weight: body.data[0].weight, height: body.data[0].height, bodyFat: body.data[0].bodyFat }
        : null
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

function createUtf8Decoder() {
  if (typeof TextDecoder === 'function') {
    const decoder = new TextDecoder('utf-8')
    return {
      decode(data) { return decoder.decode(data, { stream: true }) },
      flush() { return decoder.decode() }
    }
  }

  let pending = []
  return {
    decode(data) {
      const bytes = Array.from(new Uint8Array(data))
      const all = pending.concat(bytes)
      let completeLength = all.length
      if (all.length) {
        let start = all.length - 1
        while (start >= 0 && (all[start] & 0xc0) === 0x80) start--
        if (start >= 0) {
          const lead = all[start]
          const expected = lead < 0x80 ? 1 : lead < 0xe0 ? 2 : lead < 0xf0 ? 3 : 4
          if (all.length - start < expected) completeLength = start
        } else {
          completeLength = 0
        }
      }
      pending = all.slice(completeLength)
      return decodeUtf8Bytes(all.slice(0, completeLength))
    },
    flush() {
      const bytes = pending
      pending = []
      return decodeUtf8Bytes(bytes)
    }
  }
}

function decodeUtf8Bytes(bytes) {
  let output = ''
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++]
    if (first < 0x80) {
      output += String.fromCharCode(first)
      continue
    }
    const width = first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4
    if (i + width - 1 > bytes.length) {
      output += '\ufffd'
      break
    }
    let codePoint = first & (width === 2 ? 0x1f : width === 3 ? 0x0f : 0x07)
    let valid = true
    for (let j = 1; j < width; j++) {
      const next = bytes[i++]
      if ((next & 0xc0) !== 0x80) valid = false
      codePoint = (codePoint << 6) | (next & 0x3f)
    }
    if (!valid || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      output += '\ufffd'
    } else if (codePoint <= 0xffff) {
      output += String.fromCharCode(codePoint)
    } else {
      codePoint -= 0x10000
      output += String.fromCharCode(0xd800 + (codePoint >> 10), 0xdc00 + (codePoint & 0x3ff))
    }
  }
  return output
}

function streamAgent(payload, handlers) {
  if (!enabled()) {
    if (handlers && handlers.onError) handlers.onError(new Error('后端地址未配置'))
    return { abort() {} }
  }
  const token = getToken()
  let buffer = ''
  const utf8 = createUtf8Decoder()
  const task = wx.request({
    url: BACKEND_BASE + '/api/agent/stream', method: 'POST', data: payload,
    enableChunked: true, timeout: 60000,
    header: { 'content-type': 'application/json', Accept: '*/*', Authorization: 'Bearer ' + token },
    success: (res) => {
      const tail = utf8.flush()
      if (tail) buffer += tail
      buffer = parseSseBuffer(buffer, (event, value) => handlers.onEvent && handlers.onEvent(event, value))
      if (res.statusCode === 401 && handlers.onAuthError) handlers.onAuthError()
      else if (res.statusCode >= 400 && handlers.onError) handlers.onError(new Error('Agent 请求失败'))
    },
    fail: (err) => handlers.onError && handlers.onError(err)
  })
  if (task && task.onChunkReceived) task.onChunkReceived((chunk) => {
    const data = chunk && chunk.data
    if (typeof data === 'string') buffer += data
    else if (data) buffer += utf8.decode(data)
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

// 后端未配置或不可用时只返回占位状态，不返回未经验证的本地图片路径。
function emptyMediaMap(ids) {
  const map = {}
  ids.forEach((id) => {
    map[id] = { available: false, placeholder: PLACEHOLDER }
  })
  return map
}

// 批量拿图片映射：id -> { available, url, placeholder }
function getExerciseMediaMap(ids) {
  return new Promise((resolve) => {
    if (!ids || !ids.length) return resolve({})
    if (!BACKEND_BASE) return resolve(emptyMediaMap(ids))
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
    if (!BACKEND_BASE) return resolve({ available: false, placeholder: PLACEHOLDER })
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
  streamAgent,
  createUtf8Decoder,
  parseSseBuffer
}
