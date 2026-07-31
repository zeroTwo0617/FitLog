const auth = require('../../utils/auth.js')
const backend = require('../../utils/backend.js')
const cloud = require('../../utils/cloud.js')

const DRAFT_KEY = 'fitlog_agent_plan_draft'

Page({
  data: {
    messages: [],
    input: '',
    loading: false,
    error: '',
    draft: null,
    sessionId: '',
    lastQuery: ''
  },

  onLoad() {
    this.setData({ sessionId: 'wx-' + Date.now().toString(36) })
    if (!backend.enabled()) this.setData({ error: '请先在 utils/config.js 配置后端 HTTPS 地址' })
  },

  onInput(e) { this.setData({ input: e.detail.value }) },

  send() {
    const query = (this.data.input || '').trim()
    if (!query || this.data.loading) return
    if (!backend.enabled()) return this.setData({ error: '后端服务尚未配置' })
    const messages = this.data.messages.concat([{ role: 'user', text: query }, { role: 'assistant', text: '' }])
    this.setData({ messages, input: '', loading: true, error: '', draft: null, lastQuery: query })
    const login = backend.getToken() ? Promise.resolve() : auth.login()
    login.then(() => this.loadContext()).then((context) => {
      return new Promise((resolve, reject) => {
        this.activeStream = backend.stream({
          data: { sessionId: this.data.sessionId, action: 'plan', query, context },
          onEvent: (event, payload) => {
            if (event === 'meta' && payload.sessionId) this.setData({ sessionId: payload.sessionId })
            if (event === 'delta') this.appendAssistant(payload.text || '')
            if (event === 'plan') this.setData({ draft: payload.planDraft || null })
            if (event === 'done') { this.setData({ loading: false }); resolve() }
            if (event === 'error') { this.setData({ loading: false, error: payload.message || '服务返回错误' }); reject(new Error(payload.message || 'agent error')) }
          },
          onError: (err) => { this.setData({ loading: false, error: '连接后端失败，请稍后重试' }); reject(err) },
          onComplete: () => { if (this.data.loading) this.setData({ loading: false }); resolve() }
        })
      })
    }).catch((err) => { console.error('agent stream failed', err) })
  },

  appendAssistant(text) {
    if (!text) return
    const messages = this.data.messages.slice()
    const last = messages.length - 1
    if (last < 0 || messages[last].role !== 'assistant') return
    messages[last] = Object.assign({}, messages[last], { text: messages[last].text + text })
    this.setData({ messages })
  },

  stop() {
    if (this.activeStream && this.activeStream.stop) this.activeStream.stop()
    this.activeStream = null
    this.setData({ loading: false, error: '已停止本次生成' })
  },

  retry() {
    if (!this.data.lastQuery || this.data.loading) return
    this.setData({ input: this.data.lastQuery }, () => this.send())
  },

  loadContext() {
    const context = { goal: this.data.lastQuery, constraints: [], recentWorkouts: [], existingPlans: [] }
    return cloud.collection(cloud.C.PLANS).limit(5).get()
      .then((res) => {
        context.existingPlans = ((res && res.data) || []).map((plan) => ({
          name: plan.name || '',
          items: (plan.items || []).slice(0, 20).map((item) => ({
            exerciseId: item.exerciseId, exerciseName: item.exerciseName,
            targetSets: item.targetSets, targetReps: item.targetReps, targetWeight: item.targetWeight
          }))
        }))
        return context
      }).catch(() => context)
  },

  saveDraft() {
    if (!this.data.draft) return
    wx.setStorageSync(DRAFT_KEY, this.data.draft)
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit?fromAgent=1' })
  },

  clearError() { this.setData({ error: '' }) }
})

module.exports = { DRAFT_KEY }
