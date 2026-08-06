const agentContext = require('../../utils/agent.js')
const agentApi = require('../../utils/agentApi.js')
const agentRepo = require('../../utils/repositories/agent.js')
const page = require('../../utils/page.js')
const safeError = require('../../utils/errorText.js')
const dateUtil = require('../../utils/date.js')

const DEFAULT_MESSAGES = [{
  role: 'assistant',
  content: '告诉我你的训练目标，也可以直接说“我吃了两个鸡蛋，记录一下热量”。我会先估算，再问你是否保存。'
}]

function todayString() {
  return dateUtil.todayString()
}

function errorText(error) {
  return safeError.message(error, '服务暂时不可用，请稍后重试。')
}

function modelErrorText(error) {
  const code = error && error.code
  if (code && code.indexOf('CLOUD_FUNCTION_') === 0) return '训练助手云函数不可用，请确认已部署到当前 CloudBase 环境。'
  if (code === 'AUTH_REQUIRED') return '当前微信云开发身份未获取，请重新编译后重试。'
  if (code === 'MODEL_CONFIG_MISSING') return '训练助手暂时离线，请检查云函数中的模型环境变量。'
  if (code === 'MODEL_CONFIG_INVALID') return '训练助手暂时离线，模型服务地址配置无效。'
  if (code && code.indexOf('MODEL_REQUEST_FAILED_401') === 0) return '模型鉴权失败，请检查云函数中的 API Key。'
  if (code && code.indexOf('MODEL_REQUEST_FAILED_404') === 0) return '模型地址或模型名称不存在，请检查云函数配置。'
  if (code === 'MODEL_TIMEOUT') return '模型响应超时，请稍后重试。'
  if (code === 'MODEL_INVALID_JSON') return '模型返回内容暂时无法整理，请重试。'
  if (code === 'INVALID_DATE') return '饮食日期无效，请重新打开教练页后重试。'
  if (code === 'INVALID_MEAL' || code === 'INVALID_NUTRITION') return '饮食识别数据无效，请重新描述或上传图片。'
  if (code === 'INVALID_QUERY' || code === 'MEAL_TEXT_ANALYZE_FAILED') return '文字饮食分析失败，请换一种描述后重试。'
  if (code === 'INVALID_FILE' || code === 'FILE_DOWNLOAD_FAILED' || code === 'MEAL_ANALYZE_FAILED') return '图片分析失败，请换一张清晰图片重试。'
  return `训练助手暂时不可用。${errorText(error)}`
}

function configReady(diagnostic) {
  const config = diagnostic && diagnostic.config
  return !!(config && config.apiKeyConfigured && config.baseURLConfigured && config.modelConfigured)
}

function imageSelectionCancelled() {
  const error = new Error('图片选择已取消')
  error.code = 'USER_CANCELLED'
  return error
}

function chooseImage() {
  return new Promise((resolve, reject) => {
    const done = (result) => {
      const file = result && result.tempFiles && result.tempFiles[0]
      const path = file && (file.tempFilePath || file.path)
      if (path) resolve(path)
      else reject(imageSelectionCancelled())
    }
    const fail = (error) => {
      const message = error && (error.errMsg || error.message || '')
      if (/cancel|取消/i.test(message)) {
        reject(imageSelectionCancelled())
        return
      }
      reject(error || new Error('图片选择失败'))
    }
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: done, fail: fail })
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: done, fail: fail })
    }
  })
}

function compressImage(path) {
  return new Promise((resolve) => {
    if (!wx.compressImage) {
      resolve(path)
      return
    }
    wx.compressImage({
      src: path,
      quality: 80,
      success: (res) => resolve(res.tempFilePath || path),
      fail: () => resolve(path)
    })
  })
}

function mealMessage(meal) {
  const foods = (meal && meal.foods || []).map((item) => {
    const portion = item.portion ? `（${item.portion}）` : ''
    return `${item.name}${portion}`
  }).join('、')
  const summary = `${meal.source === 'agent' ? '文字估算' : '图片估算'}：${foods || '未识别到明确食物'}\n约 ${meal.calories} kcal · 蛋白质 ${meal.protein}g · 碳水 ${meal.carbs}g · 脂肪 ${meal.fat}g`
  return `${summary}\n${meal.note || '热量为估算值，仅供饮食记录参考。'}\n请以实际份量为准，是否保存到饮食记录？请回复“保存”或“不保存”。`
}

function mealTypeOf(query) {
  const value = String(query || '')
  if (/(早餐|早饭|早上|早晨)/.test(value)) return 'breakfast'
  if (/(午餐|午饭|中餐|中午)/.test(value)) return 'lunch'
  if (/(晚餐|晚饭|晚上|夜宵)/.test(value)) return 'dinner'
  if (/(加餐|零食|下午茶)/.test(value)) return 'snack'
  return 'other'
}

function isTextMealQuery(query) {
  const value = String(query || '').trim()
  if (!value) return false
  const trainingOnly = /(训练|锻炼|健身|动作|组数|次数|计划|怎么练|增肌训练|减脂训练)/.test(value)
  const mealAction = /(吃了|吃过|吃的|喝了|喝过|喝的|摄入)/.test(value)
    || /(饮食记录|添加到饮食|记录.*(早餐|早饭|午餐|午饭|中餐|晚餐|晚饭|加餐|下午茶|夜宵|饮食|食物|热量|卡路里|营养))/.test(value)
  const mealSlot = /(早餐|早饭|午餐|午饭|中餐|晚餐|晚饭|加餐|下午茶|夜宵)/.test(value)
  const nutrition = /(热量|卡路里|营养|蛋白质|碳水|脂肪)/.test(value)
  if (trainingOnly && !/(吃|喝|摄入|饮食|餐|食物|热量|卡路里)/.test(value)) return false
  return mealAction || (mealSlot && (nutrition || /记录|吃|喝|食物/.test(value)))
}

function mealSaveDecision(query) {
  const value = String(query || '').trim().replace(/[。！!？?，,、\s]/g, '')
  if (/^(不保存|不添加|不要保存|不要添加|否|不用|取消|算了|跳过)/.test(value)) return false
  if (/^(保存|添加|确认|确定|好|好的|是|可以|记下|记账)/.test(value)) return true
  return null
}

page({
  data: {
    theme: 'light',
    messages: DEFAULT_MESSAGES,
    input: '',
    sending: false,
    uploading: false,
    sessionId: '',
    context: null,
    loadingContext: true,
    error: '',
    planDraft: null,
    savingMeal: false,
    pendingMeal: null,
    pendingMealQuery: '',
    agentOnline: false,
    availabilityStatus: 'checking',
    availabilityText: '检查服务中'
  },

  onLoad() {
    this._destroyed = false
    this._requestToken = 0
    this._availabilityToken = 0
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.checkAvailability()
    this.loadSession()
  },

  onUnload() {
    this._destroyed = true
    this._requestToken += 1
    this._availabilityToken += 1
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    if (!this.data.agentOnline && this.data.availabilityStatus === 'offline') this.checkAvailability()
  },

  checkAvailability() {
    const token = ++this._availabilityToken
    this.setData({ availabilityStatus: 'checking', availabilityText: '检查服务中' })
    return agentApi.diagnose().then((diagnostic) => {
      if (this._destroyed || token !== this._availabilityToken) return false
      const online = configReady(diagnostic)
      this.setData({
        agentOnline: online,
        availabilityStatus: online ? 'online' : 'offline',
        availabilityText: online ? '在线' : '离线',
        error: online ? '' : '训练助手暂时离线，请检查云函数模型配置后重试。'
      })
      return online
    }).catch((error) => {
      if (this._destroyed || token !== this._availabilityToken) return false
      this.setData({
        agentOnline: false,
        availabilityStatus: 'offline',
        availabilityText: '离线',
        error: modelErrorText(error)
      })
      return false
    })
  },

  loadSession() {
    const token = ++this._requestToken
    const sessionId = wx.getStorageSync(agentApi.sessionKey('training')) || ''
    Promise.all([
      agentContext.buildContext().catch(() => ({})),
      agentContext.loadSession(sessionId).catch(() => null)
    ]).then(([context, session]) => {
      if (this._destroyed || token !== this._requestToken) return
      const messages = session && agentContext.normalizeMessages(session.messages)
      this.setData({
        context,
        loadingContext: false,
        sessionId: session && session._id ? session._id : sessionId,
        messages: messages && messages.length ? messages : DEFAULT_MESSAGES
      })
    }).catch((error) => {
      if (this._destroyed || token !== this._requestToken) return
      console.error('加载教练数据失败', error)
      this.setData({ loadingContext: false, context: {}, error: '训练数据暂时不可用，请稍后重试。' })
    })
  },

  onInput(e) { this.setData({ input: e.detail.value }) },

  usePrompt(e) {
    if (!this.data.agentOnline || this.data.sending || this.data.uploading || this.data.savingMeal) return
    this.setData({ input: e.currentTarget.dataset.query || '' })
  },

  send() {
    const query = (this.data.input || '').trim()
    if (!query || this.data.sending || this.data.uploading || this.data.savingMeal || !this.data.agentOnline) return
    if (this.data.pendingMeal) {
      const decision = mealSaveDecision(query)
      if (decision !== null) {
        this.confirmMeal(query, decision)
        return
      }
      const messages = this.data.messages.concat([
        { role: 'user', content: query },
        { role: 'assistant', content: '请回复“保存”或“不保存”，我再处理这份饮食记录。' }
      ])
      this.setData({ messages, input: '', error: '' })
      return
    }
    const messages = this.data.messages.concat([
      { role: 'user', content: query },
      { role: 'assistant', content: '' }
    ])
    const assistantIndex = messages.length - 1
    const token = ++this._requestToken
    this.setData({ messages, input: '', sending: true, error: '', planDraft: null })
    const textMeal = isTextMealQuery(query)
    const request = textMeal
      ? agentApi.analyzeTextMeal(query, todayString(), mealTypeOf(query))
      : agentApi.chat('training', query, this.data.context || {}, this.data.sessionId)
    request.then((result) => {
      if (this._destroyed || token !== this._requestToken) return
      const next = this.data.messages.slice()
      if (textMeal) {
        const meal = result && result.meal
        if (!meal) throw new Error('文字饮食识别结果无效')
        next[assistantIndex] = { role: 'assistant', content: mealMessage(meal) }
        this.setData({ messages: next, sending: false, planDraft: null, pendingMeal: meal, pendingMealQuery: query })
        return
      }
      next[assistantIndex] = { role: 'assistant', content: result.message || '这次没有生成有效回复，请重试。' }
      this.setData({
        messages: next,
        sending: false,
        sessionId: result.sessionId || this.data.sessionId,
        planDraft: result.planDraft || null
      })
      if (result.sessionId) wx.setStorageSync(agentApi.sessionKey('training'), result.sessionId)
    }).catch((error) => {
      if (this._destroyed || token !== this._requestToken) return
      const next = this.data.messages.slice()
      next[assistantIndex] = { role: 'assistant', content: '这次没有收到线上回复，请点击重试。' }
      this.setData({ messages: next, sending: false, planDraft: null, error: modelErrorText(error) })
      this.checkAvailability()
    })
  },

  stop() {
    if (!this.data.sending) return
    this._requestToken += 1
    const messages = this.data.messages.slice()
    if (messages[messages.length - 1] && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content) messages.pop()
    this.setData({ messages, sending: false, error: '已停止本次请求。' })
  },

  confirmMeal(query, shouldSave) {
    const meal = this.data.pendingMeal
    if (!meal || this.data.savingMeal) return
    const messages = this.data.messages.concat([
      { role: 'user', content: query },
      { role: 'assistant', content: shouldSave ? '正在添加到饮食记录...' : '好的，这次不保存这份饮食记录。' }
    ])
    const assistantIndex = messages.length - 1
    this.setData({ messages, input: '', error: '', savingMeal: shouldSave })
    if (!shouldSave) {
      this.setData({ pendingMeal: null, pendingMealQuery: '' })
      return
    }
    agentApi.saveMeal(meal).then(() => {
      if (this._destroyed) return
      this.setData({
        [`messages[${assistantIndex}].content`]: '已添加到饮食记录。',
        pendingMeal: null,
        pendingMealQuery: '',
        savingMeal: false
      })
    }).catch((error) => {
      if (this._destroyed) return
      this.setData({
        [`messages[${assistantIndex}].content`]: '添加失败，请回复“保存”重试，或回复“不保存”放弃。',
        savingMeal: false,
        error: modelErrorText(error)
      })
    })
  },

  retry() {
    if (this.data.sending || this.data.uploading || !this.data.agentOnline) return
    const pendingMealQuery = this.data.pendingMealQuery
    if (pendingMealQuery) {
      const messages = this.data.messages.slice()
      if (messages[messages.length - 1] && messages[messages.length - 1].role === 'assistant') messages.pop()
      if (messages[messages.length - 1] && messages[messages.length - 1].role === 'user') messages.pop()
      this.setData({ messages, input: pendingMealQuery, pendingMeal: null, pendingMealQuery: '' }, () => this.send())
      return
    }
    const messages = this.data.messages.slice()
    let lastQuery = ''
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content !== '[上传图片]') { lastQuery = messages[i].content; break }
    }
    if (!lastQuery) return
    if (messages[messages.length - 1] && messages[messages.length - 1].role === 'assistant') messages.pop()
    if (messages[messages.length - 1] && messages[messages.length - 1].role === 'user') messages.pop()
    this.setData({ messages, input: lastQuery }, () => this.send())
  },

  clearSession() {
    if (this.data.sending || this.data.uploading || this.data.savingMeal) return
    wx.removeStorageSync(agentApi.sessionKey('training'))
    this.setData({ messages: DEFAULT_MESSAGES, sessionId: '', planDraft: null, pendingMeal: null, pendingMealQuery: '', error: '' })
  },

  chooseImage() {
    if (!this.data.agentOnline || this.data.sending || this.data.uploading || this.data.savingMeal || this.data.pendingMeal) return
    this.setData({ uploading: true, error: '' })
    let fileID = ''
    chooseImage()
      .then((path) => compressImage(path))
      .then((filePath) => agentApi.prepareUpload().then((upload) => ({ filePath, upload })))
      .then(({ filePath, upload }) => {
        if (!upload || !upload.cloudPath) throw new Error('图片上传路径无效')
        return agentRepo.uploadImage(upload.cloudPath, filePath)
      })
      .then((uploadResult) => {
        fileID = uploadResult && uploadResult.fileID
        if (!fileID) throw new Error('图片上传失败')
        return agentApi.registerUpload(fileID).then(() => agentApi.analyzeMeal(fileID, todayString(), 'other'))
      })
      .then((result) => {
        const meal = result && result.meal
        if (!meal) throw new Error('图片识别结果无效')
        const next = this.data.messages.concat([
          { role: 'user', content: '[上传图片]' },
          { role: 'assistant', content: mealMessage(meal) }
        ])
        this.setData({ messages: next, uploading: false, error: '', pendingMeal: meal, pendingMealQuery: '' })
      })
      .catch((error) => {
        if (error && error.code === 'USER_CANCELLED') {
          this.setData({ uploading: false, error: '' })
          return
        }
        if (fileID) agentRepo.deleteImage(fileID).catch(() => {})
        this.setData({ uploading: false, error: modelErrorText(error) })
      })
  },

  saveDraft() {
    if (!this.data.planDraft) return
    wx.setStorageSync('fitlog_agent_plan_draft', this.data.planDraft)
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit' })
  }
})
