const cloud = require('../../utils/cloud.js')
const auth = require('../../utils/auth.js')
const nutrition = require('../../utils/nutrition.js')

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : nutrition.today()
}

function emptySummary() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 }
}

Page({
  data: {
    theme: 'light',
    date: nutrition.today(),
    loading: true,
    saving: false,
    records: [],
    summary: emptySummary(),
    dailyTargetCalories: 0,
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
    const db = cloud.db()
    Promise.all([
      db.collection(cloud.C.NUTRITION_LOGS).where({ dateStr: this.data.date }).get().catch(() => ({ data: [] })),
      db.collection(cloud.C.DIET_PLANS).orderBy('updatedAt', 'desc').limit(1).get().catch(() => ({ data: [] }))
    ]).then(([mealRes, planRes]) => {
      const records = ((mealRes && mealRes.data) || []).map((item) => Object.assign({}, item, {
        mealTypeLabel: nutrition.mealLabel(item.mealType)
      }))
      const summary = nutrition.aggregateByDate(records)[this.data.date] || emptySummary()
      const latestPlan = planRes && planRes.data && planRes.data[0]
      this.setData({
        loading: false,
        records,
        summary,
        dailyTargetCalories: Number(latestPlan && latestPlan.dailyTarget && latestPlan.dailyTarget.calories) || 0
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
    const result = nutrition.normalizeMeal(Object.assign({}, editor, { dateStr: this.data.date, source: 'manual' }))
    const id = this.data.editingId
    const db = cloud.db()
    this.setData({ saving: true, error: '' })
    auth.ensureUser().then(() => {
      if (id) {
        return db.collection(cloud.C.NUTRITION_LOGS).doc(id).update({ data: Object.assign({}, result, { updatedAt: new Date() }) })
      }
      return db.collection(cloud.C.NUTRITION_LOGS).add({ data: Object.assign({}, result, { createdAt: new Date(), updatedAt: new Date() }) })
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
        auth.ensureUser().then(() => cloud.collection(cloud.C.NUTRITION_LOGS).doc(id).remove()).then(() => {
          this.setData({ saving: false, editor: null, editingId: '' })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.load()
        }).catch((err) => this.setData({ saving: false, error: (err && (err.errMsg || err.message)) || '删除失败，请稍后重试。' }))
      }
    })
  }
})
