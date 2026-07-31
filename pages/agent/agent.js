const backend = require('../../utils/backend.js')

Page({
  data: {
    theme: 'dark',
    messages: [{ role: 'assistant', content: '告诉我你的训练目标、每周可训练几天，以及有没有需要避开的动作。' }],
    input: '',
    sending: false,
    sessionId: '',
    planDraft: null,
    context: null
  },

  onLoad() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    backend.backendLogin().then(() => backend.buildAgentContext()).then((context) => {
      this.setData({ context })
    }).catch((err) => {
      this.setData({ context: {} })
      wx.showToast({ title: err.message || '后端连接失败', icon: 'none' })
    })
  },

  onInput(e) { this.setData({ input: e.detail.value }) },

  send() {
    const query = (this.data.input || '').trim()
    if (!query || this.data.sending) return
    const messages = this.data.messages.concat([{ role: 'user', content: query }, { role: 'assistant', content: '' }])
    this.setData({ messages, input: '', sending: true, planDraft: null })
    const assistantIndex = messages.length - 1
    const append = (text) => {
      const next = this.data.messages.slice()
      next[assistantIndex] = Object.assign({}, next[assistantIndex], { content: (next[assistantIndex].content || '') + text })
      this.setData({ messages: next })
    }
    const finish = () => this.setData({ sending: false })
    const start = (context) => {
      this.task = backend.streamAgent({ action: 'plan', query, sessionId: this.data.sessionId, context: context || {} }, {
        onEvent: (event, data) => {
          if (event === 'meta' && data.sessionId) this.setData({ sessionId: data.sessionId })
          if (event === 'delta' && data.text) append(data.text)
          if (event === 'plan' && data.planDraft) this.setData({ planDraft: data.planDraft })
          if (event === 'done') finish()
          if (event === 'error') { append('\n\n' + (data.message || 'Agent 暂时不可用')); finish() }
        },
        onAuthError: () => backend.backendLogin().then(() => start(context)).catch(() => { append('\n\n登录已过期，请稍后重试'); finish() }),
        onError: (err) => { append('\n\n' + (err.message || '请求失败')); finish() }
      })
    }
    start(this.data.context)
  },

  stop() {
    if (this.task && this.task.abort) this.task.abort()
    this.setData({ sending: false })
  },

  saveDraft() {
    if (!this.data.planDraft) return
    wx.setStorageSync('fitlog_agent_plan_draft', this.data.planDraft)
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit' })
  }
})
