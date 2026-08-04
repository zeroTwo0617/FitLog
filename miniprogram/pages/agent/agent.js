const agentContext = require('../../utils/agent.js')
const agentApi = require('../../utils/agentApi.js')
const page = require('../../utils/page.js')

const DEFAULT_MESSAGES = [{
  role: 'assistant',
  content: '告诉我你的训练目标、每周可训练几天，以及有没有需要避开的动作。'
}]

function todayString() {
  const date = new Date()
  const pad = (value) => (value < 10 ? '0' + value : String(value))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function errorText(error) {
  if (!error) return '服务暂时不可用，请稍后重试。'
  return error.message || '服务暂时不可用，请稍后重试。'
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
  if (code === 'INVALID_MEAL' || code === 'INVALID_NUTRITION') return '饮食识别数据无效，请重新上传图片。'
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

function uploadFile(cloudPath, filePath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({ cloudPath, filePath, success: resolve, fail: reject })
  })
}

function mealMessage(meal) {
  const foods = (meal && meal.foods || []).map((item) => {
    const portion = item.portion ? `（${item.portion}）` : ''
    return `${item.name}${portion}`
  }).join('、')
  const summary = `图片估算：${foods || '未识别到明确食物'}\n约 ${meal.calories} kcal · 蛋白质 ${meal.protein}g · 碳水 ${meal.carbs}g · 脂肪 ${meal.fat}g`
  return `${summary}\n${meal.note || '热量为估算值，仅供饮食记录参考。'}\n请以实际份量为准，确认后点击下方按钮添加到饮食记录。`
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
    if (!this.data.agentOnline || this.data.sending || this.data.uploading) return
    this.setData({ input: e.currentTarget.dataset.query || '' })
  },

  send() {
    const query = (this.data.input || '').trim()
    if (!query || this.data.sending || this.data.uploading || !this.data.agentOnline) return
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

  retry() {
    if (this.data.sending || this.data.uploading || !this.data.agentOnline) return
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
    this.setData({ messages: DEFAULT_MESSAGES, sessionId: '', planDraft: null, error: '' })
  },

  chooseImage() {
    if (!this.data.agentOnline || this.data.sending || this.data.uploading || this.data.savingMeal) return
    this.setData({ uploading: true, error: '' })
    let fileID = ''
    chooseImage()
      .then((path) => compressImage(path))
      .then((filePath) => agentApi.prepareUpload().then((upload) => ({ filePath, upload })))
      .then(({ filePath, upload }) => {
        if (!upload || !upload.cloudPath) throw new Error('图片上传路径无效')
        return uploadFile(upload.cloudPath, filePath)
      })
      .then((uploadResult) => {
        fileID = uploadResult && uploadResult.fileID
        if (!fileID) throw new Error('图片上传失败')
        return agentApi.analyzeMeal(fileID, todayString(), 'other')
      })
      .then((result) => {
        const meal = result && result.meal
        if (!meal) throw new Error('图片识别结果无效')
        const next = this.data.messages.concat([
          { role: 'user', content: '[上传图片]' },
          { role: 'assistant', content: mealMessage(meal), meal: meal, mealSaved: false }
        ])
        this.setData({ messages: next, uploading: false, error: '' })
      })
      .catch((error) => {
        if (error && error.code === 'USER_CANCELLED') {
          this.setData({ uploading: false, error: '' })
          return
        }
        if (fileID && wx.cloud && wx.cloud.deleteFile) wx.cloud.deleteFile({ fileList: [fileID] }).catch(() => {})
        this.setData({ uploading: false, error: modelErrorText(error) })
      })
  },

  saveMeal(e) {
    const index = Number(e.currentTarget.dataset.index)
    const message = this.data.messages[index]
    if (!message || !message.meal || message.mealSaved || this.data.savingMeal) return
    this.setData({ savingMeal: true, error: '' })
    agentApi.saveMeal(message.meal).then(() => {
      if (this._destroyed) return
      this.setData({ [`messages[${index}].mealSaved`]: true, savingMeal: false })
      wx.showToast({ title: '已添加到饮食记录', icon: 'success' })
    }).catch((error) => {
      if (this._destroyed) return
      this.setData({ savingMeal: false, error: modelErrorText(error) })
    })
  },

  saveDraft() {
    if (!this.data.planDraft) return
    wx.setStorageSync('fitlog_agent_plan_draft', this.data.planDraft)
    wx.navigateTo({ url: '/pages/plan-edit/plan-edit' })
  }
})
