const localAgent = require('../../utils/agent.js')
const agentApi = require('../../utils/agentApi.js')
const page = require('../../utils/page.js')

function errorText(error) {
  if (!error) return '服务暂时不可用，请稍后重试'
  const code = error.code ? `（${error.code}）` : ''
  return `${code}${error.message || '服务暂时不可用，请稍后重试'}`
}

function modelErrorText(error) {
  const code = error && error.code
  const detail = errorText(error)
  if (code && code.indexOf('CLOUD_FUNCTION_') === 0) return `Agent 云函数调用失败，请确认已部署到当前 CloudBase 环境。${detail}`
  if (code === 'AUTH_REQUIRED') return `当前微信云开发身份未获取，请重新编译并确认小程序使用了正确的云环境。${detail}`
  if (code === 'MODEL_CONFIG_MISSING') return `云函数没有读到完整模型配置，请检查 LLM_API_KEY、LLM_BASE_URL、LLM_MODEL。${detail}`
  if (code === 'MODEL_CONFIG_INVALID') return `模型地址配置无效，请检查 LLM_BASE_URL。${detail}`
  if (code && code.indexOf('MODEL_REQUEST_FAILED_401') === 0) return `模型鉴权失败，请检查 API Key 是否有效、余额或权限。${detail}`
  if (code && code.indexOf('MODEL_REQUEST_FAILED_404') === 0) return `模型地址或模型名称不存在，请检查 LLM_BASE_URL 和 LLM_MODEL。${detail}`
  if (code === 'MODEL_TIMEOUT') return `模型请求超时，请检查云函数网络和模型服务状态。${detail}`
  if (code === 'MODEL_INVALID_JSON') return `模型已返回，但不是可保存的结构化 JSON。${detail}`
  return `大模型暂时不可用，已使用本地训练建议。${detail}`
}

function configDiagnosticText(config) {
  if (!config) return ''
  const key = config.apiKeyConfigured ? '已读到' : '未读到'
  const baseURL = config.baseURLConfigured ? (config.baseURLHost || '已配置') : '未读到'
  const model = config.modelConfigured ? '已读到' : '未读到'
  return `云函数配置诊断：API Key ${key}，Base URL ${baseURL}，模型 ${model}。`
}

page({
  data: {
    theme: 'light',
    messages: localAgent.DEFAULT_MESSAGES,
    input: '',
    sending: false,
    sessionId: '',
    context: null,
    loadingContext: true,
    error: '',
    planDraft: null
  },

  onLoad() {
    this._destroyed = false
    this._requestToken = 0
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.loadSession()
  },

  onUnload() {
    this._destroyed = true
    this._requestToken += 1
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  loadSession() {
    const token = ++this._requestToken
    const sessionId = wx.getStorageSync(agentApi.sessionKey('training')) || (localAgent.SESSION_KEY && wx.getStorageSync(localAgent.SESSION_KEY)) || ''
    Promise.all([localAgent.buildContext(), localAgent.loadSession(sessionId)]).then(([context, session]) => {
      if (this._destroyed || token !== this._requestToken) return
      const messages = session && localAgent.normalizeMessages(session.messages)
      this.setData({
        context,
        loadingContext: false,
        sessionId: session && session._id ? session._id : sessionId,
        messages: messages && messages.length ? messages : localAgent.DEFAULT_MESSAGES
      })
    }).catch((error) => {
      if (this._destroyed || token !== this._requestToken) return
      console.error('加载教练数据失败', error)
      this.setData({ loadingContext: false, context: {}, error: '云端数据暂时不可用，仍可继续输入。' })
    })
  },

  onInput(e) { this.setData({ input: e.detail.value }) },

  send() {
    const query = (this.data.input || '').trim()
    if (!query || this.data.sending) return
    const messages = this.data.messages.concat([
      { role: 'user', content: query },
      { role: 'assistant', content: '' }
    ])
    const assistantIndex = messages.length - 1
    const token = ++this._requestToken
    this.setData({ messages, input: '', sending: true, error: '', planDraft: null })
    agentApi.chat('training', query, this.data.context || {}, this.data.sessionId).then((result) => {
      if (this._destroyed || token !== this._requestToken) return
      const next = this.data.messages.slice()
      next[assistantIndex] = { role: 'assistant', content: result.message || '' }
      this.setData({
        messages: next,
        sending: false,
        sessionId: result.sessionId || this.data.sessionId,
        planDraft: result.planDraft || null
      })
      if (result.sessionId) wx.setStorageSync(agentApi.sessionKey('training'), result.sessionId)
    }).catch((error) => {
      if (this._destroyed || token !== this._requestToken) return
      const fallback = localAgent.reply(query, this.data.context || {})
      const next = this.data.messages.slice()
      next[assistantIndex] = { role: 'assistant', content: fallback.text }
      const diagnosticMessage = modelErrorText(error)
      this.setData({ messages: next, sending: false, planDraft: fallback.planDraft || null, error: diagnosticMessage })
      agentApi.diagnose().then((diagnostic) => {
        if (this._destroyed || token !== this._requestToken || !diagnostic || !diagnostic.config) return
        this.setData({ error: `${diagnosticMessage} ${configDiagnosticText(diagnostic.config)}` })
      }).catch(() => {})
      localAgent.persistSession(this.data.sessionId, next, this.data.context || {})
        .then((id) => { if (id) wx.setStorageSync(agentApi.sessionKey('training'), id) })
        .catch((saveError) => console.error('保存本地降级会话失败', saveError))
    })
  },

  stop() {
    if (!this.data.sending) return
    this._requestToken += 1
    this.setData({ sending: false, error: '已停止本次请求。' })
  },

  retry() {
    if (this.data.sending) return
    const messages = this.data.messages.slice()
    let lastQuery = ''
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastQuery = messages[i].content; break }
    }
    if (!lastQuery) return
    if (messages[messages.length - 1] && messages[messages.length - 1].role === 'assistant') messages.pop()
    if (messages[messages.length - 1] && messages[messages.length - 1].role === 'user') messages.pop()
    this.setData({ messages, input: lastQuery }, () => this.send())
  },

  clearSession() {
    if (this.data.sending) return
    wx.removeStorageSync(agentApi.sessionKey('training'))
    wx.removeStorageSync(localAgent.SESSION_KEY)
    this.setData({ messages: localAgent.DEFAULT_MESSAGES, sessionId: '', planDraft: null, error: '' })
  },

  saveDraft() {
    if (!this.data.planDraft) return
    wx.setStorageSync('fitlog_agent_plan_draft', this.data.planDraft)
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit' })
  }
})
