const config = require('./config.js')

const TOKEN_KEY = 'fitlog_backend_jwt'
const EXPIRES_KEY = 'fitlog_backend_jwt_expires'

function enabled() {
  return !!(config.BACKEND_URL && config.BACKEND_URL.trim())
}

function baseUrl() {
  return (config.BACKEND_URL || '').replace(/\/$/, '')
}

function getToken() {
  const expires = Number(wx.getStorageSync(EXPIRES_KEY) || 0)
  if (expires && expires < Date.now()) {
    clearToken()
    return ''
  }
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token, expiresIn) {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(EXPIRES_KEY, Date.now() + Math.max(60, Number(expiresIn || 7200) - 60) * 1000)
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(EXPIRES_KEY)
}

function login(code) {
  if (!enabled()) return Promise.resolve(null)
  return request({ path: '/api/auth/wx-login', method: 'POST', data: { code }, auth: false })
    .then((res) => {
      setToken(res.token, res.expiresIn)
      return res
    })
}

function request(options) {
  if (!enabled()) return Promise.reject(new Error('backend is not configured'))
  const opts = options || {}
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.header || {})
  const token = getToken()
  if (token && opts.auth !== false) headers.Authorization = 'Bearer ' + token
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl() + opts.path,
      method: opts.method || 'GET',
      data: opts.data,
      header: headers,
      timeout: opts.timeout || 15000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res.data)
        if (res.statusCode === 401) clearToken()
        const body = res.data || {}
        reject(Object.assign(new Error(body.message || 'backend request failed'), { statusCode: res.statusCode, body }))
      },
      fail: reject
    })
  })
}

function stream(options) {
  if (!enabled()) return { stop() {}, promise: Promise.reject(new Error('backend is not configured')) }
  const opts = options || {}
  let buffer = ''
  let eventName = 'message'
  let stopped = false
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null
  const callbacks = opts.onEvent || function () {}
  const parse = () => {
    buffer = buffer.replace(/\r\n/g, '\n')
    let split = buffer.indexOf('\n\n')
    while (split >= 0) {
      const raw = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      let data = ''
      raw.split(/\r?\n/).forEach((line) => {
        if (line.indexOf('event:') === 0) eventName = line.slice(6).trim()
        if (line.indexOf('data:') === 0) data += line.slice(5).trim()
      })
      if (data) {
        let payload = data
        try { payload = JSON.parse(data) } catch (e) {}
        callbacks(eventName, payload)
      }
      eventName = 'message'
      split = buffer.indexOf('\n\n')
    }
  }
  const req = wx.request({
    url: baseUrl() + (opts.path || '/api/agent/stream'),
    method: 'POST',
    data: opts.data,
    enableChunked: true,
    responseType: 'text',
    timeout: opts.timeout || 65000,
    header: Object.assign({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }, getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    success: (res) => {
      if (res.statusCode === 401) clearToken()
      if (res.statusCode < 200 || res.statusCode >= 300) opts.onError && opts.onError(new Error('backend status ' + res.statusCode))
      opts.onComplete && opts.onComplete()
    },
    fail: (err) => { if (!stopped && opts.onError) opts.onError(err) }
  })
  if (req && req.onChunkReceived) {
    req.onChunkReceived((chunk) => {
      if (stopped) return
      let text = ''
      if (decoder) text = decoder.decode(chunk.data, { stream: true })
      else text = String.fromCharCode.apply(null, new Uint8Array(chunk.data))
      buffer += text
      parse()
    })
  }
  return { stop() { stopped = true; if (req && req.abort) req.abort() } }
}

module.exports = { enabled, getToken, setToken, clearToken, login, request, stream, TOKEN_KEY }
