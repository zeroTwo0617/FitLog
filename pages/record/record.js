const ex = require('../../utils/exerciseData.js')
const cloud = require('../../utils/cloud.js')
const auth = require('../../utils/auth.js')

function fmtToday() {
  const d = new Date()
  const p = (n) => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// 一组默认空数据
function blankSet() {
  return { reps: '', weight: '', rest: '' }
}

Page({
  data: {
    today: fmtToday(),
    session: [],      // [{exerciseId, name, nameEn, sets:[{reps,weight,rest}]}]
    showPicker: false,
    keyword: '',
    activeCat: '',
    categories: ex.categoryOptions(),
    pickerList: [],
    saving: false
  },

  onLoad() {
    this.refreshPicker()
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

  // ===== 当前训练编辑 =====
  addExercise(e) {
    const id = e.currentTarget.dataset.id
    const ex0 = ex.getById(id)
    if (!ex0) return
    if (this.data.session.some(s => s.exerciseId === id)) {
      wx.showToast({ title: '该动作已在列表中', icon: 'none' })
      return
    }
    const session = this.data.session.concat([{
      exerciseId: ex0.id,
      name: ex0.nameZh,
      nameEn: ex0.name,
      sets: [blankSet()]
    }])
    this.setData({ session, showPicker: false })
  },

  removeExercise(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const session = this.data.session.slice()
    session.splice(idx, 1)
    this.setData({ session })
  },

  addSet(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const session = this.data.session.slice()
    session[idx] = Object.assign({}, session[idx])
    session[idx].sets = session[idx].sets.concat([blankSet()])
    this.setData({ session })
  },

  removeSet(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const si = Number(e.currentTarget.dataset.sidx)
    const session = this.data.session.slice()
    if (session[idx].sets.length <= 1) {
      wx.showToast({ title: '至少保留一组', icon: 'none' })
      return
    }
    session[idx] = Object.assign({}, session[idx])
    session[idx].sets = session[idx].sets.slice()
    session[idx].sets.splice(si, 1)
    this.setData({ session })
  },

  onReps(e) {
    this.updateSet(e, 'reps')
  },
  onWeight(e) {
    this.updateSet(e, 'weight')
  },
  onRest(e) {
    this.updateSet(e, 'rest')
  },

  updateSet(e, field) {
    const idx = Number(e.currentTarget.dataset.idx)
    const si = Number(e.currentTarget.dataset.sidx)
    const session = this.data.session.slice()
    session[idx] = Object.assign({}, session[idx])
    session[idx].sets = session[idx].sets.slice()
    session[idx].sets[si] = Object.assign({}, session[idx].sets[si], { [field]: e.detail.value })
    this.setData({ session })
  },

  // ===== 保存训练：先写 workouts，再批量写 sets =====
  save() {
    if (this.data.saving) return
    const session = this.data.session
    if (!session || session.length === 0) {
      wx.showToast({ title: '请先添加一个动作', icon: 'none' })
      return
    }
    // 校验：至少一组有次数或重量
    let hasData = false
    session.forEach(s => s.sets.forEach(st => {
      if ((st.reps !== '' && st.reps != null) || (st.weight !== '' && st.weight != null)) hasData = true
    }))
    if (!hasData) {
      wx.showToast({ title: '请填写至少一组次数或重量', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    const db = cloud.db()

    auth.ensureUser()
      .then(() => {
        const summary = session.map(s => ({
          exerciseId: s.exerciseId,
          name: s.name,
          nameEn: s.nameEn,
          setCount: s.sets.length
        }))
        return db.collection(cloud.C.WORKOUTS).add({
          data: {
            date: new Date(),
            dateStr: this.data.today,
            title: '',
            exercises: summary,
            setTotal: session.reduce((acc, s) => acc + s.sets.length, 0),
            createdAt: new Date()
          }
        })
      })
      .then((res) => {
        const sessionId = res._id
        const tasks = []
        session.forEach(s => {
          s.sets.forEach((st, i) => {
            tasks.push(db.collection(cloud.C.SETS).add({
              data: {
                sessionId: sessionId,
                exerciseId: s.exerciseId,
                exerciseName: s.name,
                setIndex: i + 1,
                reps: (st.reps === '' || st.reps == null) ? null : Number(st.reps),
                weight: (st.weight === '' || st.weight == null) ? null : Number(st.weight),
                restSec: (st.rest === '' || st.rest == null) ? null : Number(st.rest),
                completed: true,
                createdAt: new Date()
              }
            }))
          })
        })
        return Promise.all(tasks)
      })
      .then(() => {
        this.setData({ saving: false, session: [], showPicker: false })
        wx.showToast({ title: '已保存', icon: 'success' })
      })
      .catch((err) => {
        this.setData({ saving: false })
        wx.showToast({ title: '保存失败', icon: 'none' })
        console.error('保存训练失败', err)
      })
  }
})
