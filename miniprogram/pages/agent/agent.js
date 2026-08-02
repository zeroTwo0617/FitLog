const localAgent = require('../../utils/agent.js')
const agentApi = require('../../utils/agentApi.js')
const nutrition = require('../../utils/nutrition.js')
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
  if (code === 'MODEL_CONFIG_MISSING') return `云函数没有读到完整模型配置，请在 CloudBase 的 agent 云函数环境变量中检查 LLM_API_KEY、LLM_BASE_URL、LLM_MODEL。${detail}`
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
    mode: 'training',
    messages: localAgent.DEFAULT_MESSAGES,
    input: '',
    sending: false,
    sessionId: '',
    context: null,
    loadingContext: true,
    error: '',
    planDraft: null,
    dietPlanDraft: null,
    dietPlanSaved: false,
    mealTypes: nutrition.MEAL_TYPES,
    mealTypeIndex: 1,
    mealTypeLabel: nutrition.MEAL_TYPES[1].label,
    mealDate: nutrition.today(),
    mealDraft: null,
    mealAnalyzing: false,
    mealSaving: false
  },

  onLoad() {
    this._destroyed = false
    this._requestToken = 0
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.loadMode('training')
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

  loadMode(mode) {
    const nextMode = mode === 'diet' ? 'diet' : 'training'
    const token = ++this._requestToken
    const key = agentApi.sessionKey(nextMode)
    const legacyKey = nextMode === 'training' ? localAgent.SESSION_KEY : ''
    const sessionId = wx.getStorageSync(key) || (legacyKey && wx.getStorageSync(legacyKey)) || ''
    const contextTask = nextMode === 'diet' ? localAgent.buildDietContext() : localAgent.buildContext()
    const sessionTask = localAgent.loadSession(sessionId)
    this.setData({
      mode: nextMode,
      loadingContext: true,
      error: '',
      sessionId,
      messages: nextMode === 'diet' ? localAgent.DEFAULT_DIET_MESSAGES : localAgent.DEFAULT_MESSAGES,
      planDraft: null,
      dietPlanDraft: null,
      mealDraft: null,
      dietPlanSaved: false
    })
    Promise.all([contextTask, sessionTask]).then(([context, session]) => {
      if (this._destroyed || token !== this._requestToken) return
      const messages = session && localAgent.normalizeMessages(session.messages)
      this.setData({
        context,
        loadingContext: false,
        sessionId: session && session._id ? session._id : sessionId,
        messages: messages && messages.length
          ? messages
          : (nextMode === 'diet' ? localAgent.DEFAULT_DIET_MESSAGES : localAgent.DEFAULT_MESSAGES)
      })
    }).catch((err) => {
      if (this._destroyed || token !== this._requestToken) return
      console.error('加载助手数据失败', err)
      this.setData({ loadingContext: false, context: {}, error: '云端数据暂时不可用，仍可继续输入。' })
    })
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode !== this.data.mode && !this.data.sending) this.loadMode(mode)
  },

  onInput(e) { this.setData({ input: e.detail.value }) },

  send() {
    const query = (this.data.input || '').trim()
    if (!query || this.data.sending) return
    const mode = this.data.mode
    const messages = this.data.messages.concat([
      { role: 'user', content: query },
      { role: 'assistant', content: '' }
    ])
    const assistantIndex = messages.length - 1
    const token = ++this._requestToken
    this.setData({ messages, input: '', sending: true, error: '', planDraft: null, dietPlanDraft: null, dietPlanSaved: false })
    agentApi.chat(mode, query, this.data.context || {}, this.data.sessionId).then((result) => {
      if (this._destroyed || token !== this._requestToken) return
      if (!result || !result.ok) throw new Error((result && result.message) || '模型暂时不可用')
      const next = this.data.messages.slice()
      next[assistantIndex] = { role: 'assistant', content: result.message || '' }
      this.setData({
        messages: next,
        sending: false,
        sessionId: result.sessionId || this.data.sessionId,
        planDraft: result.planDraft || null,
        dietPlanDraft: result.dietPlanDraft || null
      })
      if (result.sessionId) wx.setStorageSync(agentApi.sessionKey(mode), result.sessionId)
    }).catch((err) => {
      if (this._destroyed || token !== this._requestToken) return
      if (mode === 'training') {
        const fallback = localAgent.reply(query, this.data.context || {})
        const next = this.data.messages.slice()
        next[assistantIndex] = { role: 'assistant', content: fallback.text }
        this.setData({ messages: next, sending: false, planDraft: fallback.planDraft || null, error: '大模型暂时不可用，已切换为本地训练建议。' })
        this.setData({ error: modelErrorText(err) })
        const diagnosticMessage = modelErrorText(err)
        agentApi.diagnose().then((diagnostic) => {
          if (this._destroyed || token !== this._requestToken || !diagnostic || !diagnostic.config) return
          this.setData({ error: `${diagnosticMessage} ${configDiagnosticText(diagnostic.config)}` })
        }).catch(() => {})
        localAgent.persistSession(this.data.sessionId, next, this.data.context || {})
          .then((id) => { if (id) wx.setStorageSync(agentApi.sessionKey(mode), id) })
          .catch((saveError) => console.error('保存本地降级会话失败', saveError))
      } else {
        const next = this.data.messages.slice()
        next[assistantIndex] = { role: 'assistant', content: '饮食模型暂时不可用，请稍后重试，或先使用拍照/手动记录。' }
        this.setData({ messages: next, sending: false, error: errorText(err) })
      }
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
    wx.removeStorageSync(agentApi.sessionKey(this.data.mode))
    this.setData({
      messages: this.data.mode === 'diet' ? localAgent.DEFAULT_DIET_MESSAGES : localAgent.DEFAULT_MESSAGES,
      sessionId: '',
      planDraft: null,
      dietPlanDraft: null,
      mealDraft: null,
      error: ''
    })
  },

  saveDraft() {
    if (!this.data.planDraft) return
    wx.setStorageSync('fitlog_agent_plan_draft', this.data.planDraft)
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit' })
  },

  onMealDate(e) { this.setData({ mealDate: e.detail.value }) },

  onMealType(e) {
    const index = Number(e.detail.value)
    this.setData({ mealTypeIndex: index, mealTypeLabel: this.data.mealTypes[index].label })
    if (this.data.mealDraft) this.setData({ 'mealDraft.mealType': this.data.mealTypes[index].value })
  },

  openNutrition() {
    wx.navigateTo({ url: `/pages/nutrition/nutrition?date=${this.data.mealDate}` })
  },

  createManualMeal() {
    this.setData({
      mealDraft: nutrition.normalizeMeal({
        dateStr: this.data.mealDate,
        mealType: this.data.mealTypes[this.data.mealTypeIndex].value,
        source: 'manual',
        foods: [],
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        note: '手动记录，营养数值可按包装或食物秤修正。'
      }),
      error: ''
    })
  },

  chooseMealImage() {
    if (this.data.mealAnalyzing || this.data.mealSaving) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const item = res.tempFiles && res.tempFiles[0]
        if (item && item.tempFilePath) this.uploadMealImage(item.tempFilePath)
      },
      fail: (err) => { if (err && err.errMsg && err.errMsg.indexOf('cancel') < 0) this.setData({ error: '没有取得食物图片。' }) }
    })
  },

  uploadMealImage(path) {
    this.setData({ mealAnalyzing: true, error: '' })
    const compress = typeof wx.compressImage === 'function'
      ? new Promise((resolve) => wx.compressImage({ src: path, quality: 80, success: resolve, fail: () => resolve({ tempFilePath: path }) }))
      : Promise.resolve({ tempFilePath: path })
    compress.then((compressed) => agentApi.prepareUpload().then((uploadPath) => {
      if (!uploadPath || !uploadPath.ok || !uploadPath.cloudPath) throw new Error('无法准备安全的图片上传路径')
      return wx.cloud.uploadFile({
        cloudPath: uploadPath.cloudPath,
        filePath: compressed.tempFilePath || path
      })
    })).then((upload) => agentApi.analyzeMeal(upload.fileID, this.data.mealDate, this.data.mealTypes[this.data.mealTypeIndex].value))
      .then((result) => {
        if (!result || !result.ok || !result.meal) throw new Error((result && result.message) || '食物识别失败')
        this.setData({ mealDraft: nutrition.normalizeMeal(result.meal), mealAnalyzing: false })
      })
      .catch((err) => {
        this.setData({ mealAnalyzing: false, error: errorText(err) + ' 可改用手动记录。' })
      })
  },

  onMealField(e) {
    if (!this.data.mealDraft) return
    const field = e.currentTarget.dataset.field
    const numeric = ['calories', 'protein', 'carbs', 'fat'].includes(field)
    const value = numeric ? Number(e.detail.value) || 0 : e.detail.value
    const next = { [`mealDraft.${field}`]: value }
    if (this.data.mealDraft.source === 'manual' && ['protein', 'carbs', 'fat'].includes(field)) {
      const draft = this.data.mealDraft
      next['mealDraft.calories'] = nutrition.macroCalories(
        field === 'protein' ? value : draft.protein,
        field === 'carbs' ? value : draft.carbs,
        field === 'fat' ? value : draft.fat
      )
    }
    this.setData(next)
  },

  onFoodField(e) {
    if (!this.data.mealDraft) return
    const index = Number(e.currentTarget.dataset.index)
    const field = e.currentTarget.dataset.field
    const foods = this.data.mealDraft.foods.slice()
    foods[index] = Object.assign({}, foods[index], { [field]: ['calories', 'protein', 'carbs', 'fat'].includes(field) ? Number(e.detail.value) || 0 : e.detail.value })
    this.setData({ 'mealDraft.foods': foods })
  },

  onDietTarget(e) {
    if (!this.data.dietPlanDraft) return
    const field = e.currentTarget.dataset.field
    this.setData({ [`dietPlanDraft.dailyTarget.${field}`]: Number(e.detail.value) || 0 })
  },

  onDietMealField(e) {
    if (!this.data.dietPlanDraft) return
    const index = Number(e.currentTarget.dataset.index)
    const meals = this.data.dietPlanDraft.meals.slice()
    meals[index] = Object.assign({}, meals[index], { calories: Number(e.detail.value) || 0 })
    this.setData({ 'dietPlanDraft.meals': meals })
  },

  saveMeal() {
    if (!this.data.mealDraft || this.data.mealSaving) return
    this.setData({ mealSaving: true, error: '' })
    agentApi.saveMeal(nutrition.normalizeMeal(this.data.mealDraft)).then((result) => {
      if (!result || !result.ok) throw new Error((result && result.message) || '饮食记录保存失败')
      this.setData({ mealSaving: false, mealDraft: null })
      wx.showToast({ title: '饮食已记录', icon: 'success' })
    }).catch((err) => this.setData({ mealSaving: false, error: errorText(err) }))
  },

  saveDietPlan() {
    if (!this.data.dietPlanDraft) return
    agentApi.saveDietPlan(this.data.dietPlanDraft).then((result) => {
      if (!result || !result.ok) throw new Error((result && result.message) || '饮食计划保存失败')
      this.setData({ dietPlanSaved: true })
      wx.showToast({ title: '饮食计划已保存', icon: 'success' })
    }).catch((err) => this.setData({ error: errorText(err) }))
  }
})
