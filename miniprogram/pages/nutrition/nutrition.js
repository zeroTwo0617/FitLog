const cloud = require('../../utils/cloud.js')
const auth = require('../../utils/auth.js')
const nutrition = require('../../utils/nutrition.js')
const page = require('../../utils/page.js')
const nutritionRepo = require('../../utils/repositories/nutrition.js')

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : nutrition.today()
}

function emptySummary() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 }
}

page({
  data: {
    theme: 'light',
    date: nutrition.today(),
    loading: true,
    saving: false,
    records: [],
    summary: emptySummary(),
    mealTypes: nutrition.MEAL_TYPES,
    mealTypeIndex: 1,
    editor: null,
    editingId: '',
    error: ''
  },

  onLoad(options) {
    this._pendingId = options && options.id ? options.id : ''
    this.setData({ date: validDate(options && options.date) })
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.load()
  },

  noop() {},

  load() {
    this.setData({ loading: true, error: '' })
    nutritionRepo.listByDate(this.data.date).catch(() => []).then((recordsRaw) => {
      const records = (recordsRaw || []).map((item) => Object.assign({}, item, {
        mealTypeLabel: nutrition.mealLabel(item.mealType)
      }))
      const summary = nutrition.aggregateByDate(records)[this.data.date] || emptySummary()
      this.setData({
        loading: false,
        records,
        summary
      }, () => {
        if (this._pendingId) {
          const id = this._pendingId
          this._pendingId = ''
          const target = this.data.records.find((item) => item._id === id)
          if (target) this.editMeal({ currentTarget: { dataset: { id } } })
        }
      })
    }).catch((err) => {
      this.setData({ loading: false, error: '饮食数据加载失败，请稍后重试。' })
      console.error('加载饮食记录失败', err)
    })
  },

  onDate(e) {
    this.setData({ date: validDate(e.detail.value), editor: null, editingId: '' }, () => this.load())
  },

  newMeal() {
    const mealType = this.data.mealTypes[this.data.mealTypeIndex] || this.data.mealTypes[0]
    this.setData({
      editingId: '',
      error: '',
      editor: nutrition.normalizeMeal({
        dateStr: this.data.date,
        mealType: mealType.value,
        source: 'manual',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        note: '手动记录'
      })
    })
  },

  editMeal(e) {
    const id = e.currentTarget.dataset.id
    const record = this.data.records.find((item) => item._id === id)
    if (!record) return
    const typeIndex = Math.max(0, this.data.mealTypes.findIndex((item) => item.value === record.mealType))
    this.setData({
      editingId: id,
      mealTypeIndex: typeIndex,
      error: '',
      editor: nutrition.normalizeMeal(record)
    })
  },

  closeEditor() {
    if (this.data.saving) return
    this.setData({ editor: null, editingId: '', error: '' })
  },

  onMealType(e) {
    if (!this.data.editor) return
    const index = Number(e.detail.value)
    const mealType = this.data.mealTypes[index]
    this.setData({ mealTypeIndex: index, 'editor.mealType': mealType.value, 'editor.mealLabel': mealType.label })
  },

  onField(e) {
    if (!this.data.editor) return
    const field = e.currentTarget.dataset.field
    const value = Number(e.detail.value) || 0
    const next = { [`editor.${field}`]: value }
    if (['protein', 'carbs', 'fat'].includes(field)) {
      const editor = this.data.editor
      next['editor.calories'] = nutrition.macroCalories(
        field === 'protein' ? value : editor.protein,
        field === 'carbs' ? value : editor.carbs,
        field === 'fat' ? value : editor.fat
      )
    }
    this.setData(next)
  },

  onNote(e) {
    if (this.data.editor) this.setData({ 'editor.note': e.detail.value })
  },

  save() {
    if (!this.data.editor || this.data.saving) return
    const editor = this.data.editor
    if (Number(editor.calories) <= 0 && Number(editor.protein) <= 0 && Number(editor.carbs) <= 0 && Number(editor.fat) <= 0) {
      wx.showToast({ title: '请至少填写一项营养数据', icon: 'none' })
      return
    }
    const normalized = nutrition.normalizeMeal(Object.assign({}, editor, { dateStr: this.data.date, source: 'manual' }))
    const result = {
      dateStr: normalized.dateStr,
      mealType: normalized.mealType,
      foods: normalized.foods,
      calories: normalized.calories,
      protein: normalized.protein,
      carbs: normalized.carbs,
      fat: normalized.fat,
      source: normalized.source,
      confidence: normalized.confidence,
      note: normalized.note
    }
    const id = this.data.editingId
    this.setData({ saving: true, error: '' })
    auth.ensureUser().then(() => {
      return nutritionRepo.save(Object.assign({}, result, id ? { id: id } : {}))
    }).then(() => {
      this.setData({ saving: false, editor: null, editingId: '' })
      wx.showToast({ title: id ? '饮食已修改' : '饮食已记录', icon: 'success' })
      this.load()
    }).catch((err) => {
      this.setData({ saving: false, error: (err && (err.errMsg || err.message)) || '保存失败，请稍后重试。' })
    })
  },

  removeMeal() {
    const id = this.data.editingId
    if (!id || this.data.saving) return
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复。',
      confirmColor: '#dc5b5b',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ saving: true })
        auth.ensureUser().then(() => nutritionRepo.remove(id)).then(() => {
          this.setData({ saving: false, editor: null, editingId: '' })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.load()
        }).catch((err) => this.setData({ saving: false, error: (err && (err.errMsg || err.message)) || '删除失败，请稍后重试。' }))
      }
    })
  }
})
