const agent = require('../../utils/agent.js')

Page({
  data: {
    theme: 'light',
    messages: agent.DEFAULT_MESSAGES,
    input: '',
    sending: false,
    sessionId: '',
    planDraft: null,
    context: null,
    loadingContext: true
  },

  onLoad() {
    this._destroyed = false
    this._replyToken = 0
    this.setData({ theme: getApp().globalData.theme || 'light' })
    this.loadSession()
  },

  onUnload() {
    this._destroyed = true
    this._replyToken += 1
    if (this.replyTimer) clearTimeout(this.replyTimer)
    this.replyTimer = null
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  loadSession() {
    const sessionId = wx.getStorageSync(agent.SESSION_KEY) || ''
    Promise.all([
      agent.buildContext(),
      agent.loadSession(sessionId)
    ]).then(([context, session]) => {
      if (this._destroyed) return
      const messages = session && agent.normalizeMessages(session.messages)
      this.setData({
        context,
        loadingContext: false,
        sessionId: session && session._id ? session._id : sessionId,
        messages: messages && messages.length ? messages : agent.DEFAULT_MESSAGES
      })
    }).catch((err) => {
      console.error('加载训练助手数据失败', err)
      this.setData({ loadingContext: false, context: {}, messages: agent.DEFAULT_MESSAGES })
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
    const replyToken = ++this._replyToken
    this.setData({ messages, input: '', sending: true, planDraft: null })

    const complete = () => {
      this.replyTimer = null
      if (this._destroyed || replyToken !== this._replyToken) return
      const result = agent.reply(query, this.data.context || {})
      const next = this.data.messages.slice()
      next[assistantIndex] = { role: 'assistant', content: result.text }
      this.setData({ messages: next, planDraft: result.planDraft, sending: false })
      agent.persistSession(this.data.sessionId, next, this.data.context || {})
        .then((sessionId) => {
          if (this._destroyed || !sessionId) return
          wx.setStorageSync(agent.SESSION_KEY, sessionId)
          this.setData({ sessionId })
        })
        .catch((err) => console.error('保存助手会话失败', err))
    }
    if (typeof wx.nextTick === 'function') wx.nextTick(complete)
    else this.replyTimer = setTimeout(complete, 0)
  },

  stop() {
    if (this.replyTimer) clearTimeout(this.replyTimer)
    this.replyTimer = null
    this._replyToken += 1
    this.setData({ sending: false })
  },

  retry() {
    const messages = this.data.messages.slice()
    let lastQuery = ''
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastQuery = messages[i].content
        break
      }
    }
    if (!lastQuery || this.data.sending) return
    messages.pop()
    messages.pop()
    this.setData({ messages, input: lastQuery }, () => this.send())
  },

  clearSession() {
    if (this.data.sending) return
    wx.removeStorageSync(agent.SESSION_KEY)
    this.setData({ messages: agent.DEFAULT_MESSAGES, sessionId: '', planDraft: null })
  },

  saveDraft() {
    if (!this.data.planDraft) return
    wx.setStorageSync('fitlog_agent_plan_draft', this.data.planDraft)
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit' })
  }
})
