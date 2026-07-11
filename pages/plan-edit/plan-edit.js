const ex = require('../../utils/exerciseData.js')
const cloud = require('../../utils/cloud.js')

Page({
  data: {
    id: '',                  // 编辑时存在
    name: '',
    items: [],               // [{exerciseId, exerciseName, targetSets, targetReps, targetWeight}]
    showPicker: false,
    keyword: '',
    activeCat: '',
    categories: ex.categoryOptions(),
    pickerList: []
  },
  onLoad(options) {
    this.refreshPicker()
    if (options && options.id) {
      this.setData({ id: options.id })
      this.loadPlan(options.id)
    }
  },
  loadPlan(id) {
    const db = cloud.db()
    db.collection(cloud.C.PLANS).doc(id).get()
      .then((res) => {
        const p = res && res.data ? res.data : null
        if (!p) return
        this.setData({ name: p.name || '', items: p.items || [] })
      })
      .catch((err) => {
        wx.showToast({ title: '加载计划失败', icon: 'none' })
        console.error('加载计划失败', err)
      })
  },
  // ===== 动作选择器 =====
  refreshPicker() {
    const list = ex.list({
      keyword: this.data.keyword,
      bodyPart: this.data.activeCat
    })
    this.setData({ pickerList: list })
  },
  togglePicker() {
    this.setData({ showPicker: !this.data.showPicker })
  },
  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.refreshPicker())
  },
  onCat(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ activeCat: this.data.activeCat === cat ? '' : cat }, () => this.refreshPicker())
  },
  addExercise(e) {
    const id = e.currentTarget.dataset.id
    const ex0 = ex.getById(id)
    if (!ex0) return
    if (this.data.items.some((it) => it.exerciseId === id)) {
      wx.showToast({ title: '该动作已在计划中', icon: 'none' })
      return
    }
    const items = this.data.items.concat([{
      exerciseId: ex0.id,
      exerciseName: ex0.nameZh,
      targetSets: 3,
      targetReps: '',
      targetWeight: ''
    }])
    this.setData({ items, showPicker: false })
  },
  // ===== 编辑计划项 =====
  removeItem(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const items = this.data.items.slice()
    items.splice(idx, 1)
    this.setData({ items })
  },
  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onTarget(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const field = e.currentTarget.dataset.field
    const items = this.data.items.slice()
    items[idx] = Object.assign({}, items[idx], { [field]: e.detail.value })
    this.setData({ items })
  },
  // ===== 保存：新建 add / 编辑 set =====
  save() {
    const name = (this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请填写计划名称', icon: 'none' })
      return
    }
    if (this.data.items.length === 0) {
      wx.showToast({ title: '请至少添加一个动作', icon: 'none' })
      return
    }
    const items = this.data.items.map((it) => ({
      exerciseId: it.exerciseId,
      exerciseName: it.exerciseName,
      targetSets: (it.targetSets === '' || it.targetSets == null) ? null : Number(it.targetSets),
      targetReps: (it.targetReps === '' || it.targetReps == null) ? null : Number(it.targetReps),
      targetWeight: (it.targetWeight === '' || it.targetWeight == null) ? null : Number(it.targetWeight)
    }))
    const db = cloud.db()
    const data = { name: name, items: items }
    wx.showLoading({ title: '保存中' })
    const p = this.data.id
      ? db.collection(cloud.C.PLANS).doc(this.data.id).set({ data })
      : db.collection(cloud.C.PLANS).add({ data })
    p.then(() => {
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    }).catch((err) => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
      console.error('保存计划失败', err)
    })
  }
})
