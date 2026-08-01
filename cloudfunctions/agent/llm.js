const http = require('http')
const https = require('https')

function config() {
  const key = String(process.env.LLM_API_KEY || '').trim()
  const baseURL = String(process.env.LLM_BASE_URL || '').trim()
  const model = String(process.env.LLM_MODEL || '').trim()
  if (!key || !baseURL || !model) {
    const error = new Error('LLM 云函数环境变量未配置完整')
    error.code = 'MODEL_CONFIG_MISSING'
    throw error
  }
  let parsedURL
  try {
    parsedURL = new URL(baseURL)
  } catch (ignore) {
    const error = new Error('LLM_BASE_URL is not a valid URL')
    error.code = 'MODEL_CONFIG_INVALID'
    throw error
  }
  if (!['http:', 'https:'].includes(parsedURL.protocol)) {
    const error = new Error('LLM_BASE_URL must use http or https')
    error.code = 'MODEL_CONFIG_INVALID'
    throw error
  }
  return {
    key,
    baseURL,
    model,
    visionModel: String(process.env.LLM_VISION_MODEL || model).trim(),
    timeout: Math.min(60000, Math.max(3000, Number(process.env.LLM_TIMEOUT_MS) || 25000)),
    maxTokens: Math.min(4000, Math.max(300, Number(process.env.LLM_MAX_TOKENS) || 1600))
  }
}

function configStatus() {
  const key = String(process.env.LLM_API_KEY || '').trim()
  const baseURL = String(process.env.LLM_BASE_URL || '').trim()
  const model = String(process.env.LLM_MODEL || '').trim()
  const visionModel = String(process.env.LLM_VISION_MODEL || '').trim()
  let host = ''
  try { host = new URL(baseURL).host } catch (ignore) {}
  return {
    apiKeyConfigured: Boolean(key),
    baseURLConfigured: Boolean(baseURL),
    baseURLHost: host,
    modelConfigured: Boolean(model),
    visionModelConfigured: Boolean(visionModel || model),
    timeoutMs: Math.min(60000, Math.max(3000, Number(process.env.LLM_TIMEOUT_MS) || 25000)),
    maxTokens: Math.min(4000, Math.max(300, Number(process.env.LLM_MAX_TOKENS) || 1600))
  }
}

function endpoint(baseURL) {
  const url = new URL(baseURL)
  let pathname = url.pathname.replace(/\/+$/, '')
  if (!pathname.endsWith('/chat/completions')) pathname += '/chat/completions'
  url.pathname = pathname
  return url
}

function request(url, headers, body, timeout) {
  const transport = url.protocol === 'http:' ? http : https
  return new Promise((resolve, reject) => {
    const req = transport.request(url, {
      method: 'POST',
      headers,
      timeout
    }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = raw ? JSON.parse(raw) : {} } catch (err) {
          const error = new Error('模型返回了无法解析的响应')
          error.code = 'MODEL_BAD_RESPONSE'
          reject(error)
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error((parsed && parsed.error && parsed.error.message) || `模型请求失败：${res.statusCode}`)
          error.code = `MODEL_REQUEST_FAILED_${res.statusCode}`
          reject(error)
          return
        }
        resolve(parsed)
      })
    })
    req.on('timeout', () => {
      req.destroy()
      const error = new Error('模型请求超时')
      error.code = 'MODEL_TIMEOUT'
      reject(error)
    })
    req.on('error', (err) => {
      if (err && err.code === 'MODEL_TIMEOUT') reject(err)
      else {
        const error = new Error('模型服务暂时不可用')
        error.code = 'MODEL_UNAVAILABLE'
        reject(error)
      }
    })
    req.write(body)
    req.end()
  })
}

function contentOf(response) {
  const value = response && response.choices && response.choices[0] && response.choices[0].message
    ? response.choices[0].message.content
    : ''
  if (Array.isArray(value)) return value.map((item) => item && item.text ? item.text : '').join('')
  return String(value || '')
}

function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(cleaned) } catch (err) {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    const error = new Error('模型输出不是有效 JSON')
    error.code = 'MODEL_INVALID_JSON'
    throw error
  }
}

async function complete(messages, options) {
  const cfg = config()
  const opts = options || {}
  const payload = JSON.stringify({
    model: opts.vision ? cfg.visionModel : cfg.model,
    messages,
    temperature: 0.2,
    max_tokens: cfg.maxTokens
  })
  const response = await request(endpoint(cfg.baseURL), {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    Authorization: `Bearer ${cfg.key}`
  }, payload, cfg.timeout)
  return contentOf(response)
}

module.exports = { complete, parseJson, configStatus }
