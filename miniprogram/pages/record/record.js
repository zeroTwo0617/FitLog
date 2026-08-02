const ex = require('../../utils/exerciseData.js')
const cloud = require('../../utils/cloud.js')
const auth = require('../../utils/auth.js')
const pd = require('../../utils/planData.js')
const rt = require('../../utils/restTimer.js')
const page = require('../../utils/page.js')
const planRepo = require('../../utils/repositories/plan.js')
const workoutRepo = require('../../utils/repositories/workout.js')

function fmtToday() {
  const d = new Date()
  const p = (n) => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// 一组默认空数据（completed 复用 sets.completed 字段：练一组勾一组）
function blankSet() {
  return { reps: '', weight: '', rest: '', completed: false }
}

page({
  data: {
    today: fmtToday(),
    session: [],      // [{exerciseId, name, nameEn, sets:[{reps,weight,rest}]}]
    planId: '',         // 若由计划发起则关联
    title: '',          // 计划名（自动带入，可留空）
    showPicker: false,
    keyword: '',
    activeCat: '',
    categories: ex.categoryOptions(),
    pickerList: [],
    saving: false,
    planList: [],          // 导入计划选择器列表
    showPlanPicker: false,
    exerciseCount: 0,
    totalSets: 0,
    sessionVolume: 0,
    // 组间休息计时器状态
    restRunning: false,
    restDone: false,
    restEndAt: 0,
    restTotal: rt.DEFAULT_REST,
    restRemain: rt.DEFAULT_REST,
    restRemainText: String(rt.DEFAULT_REST),
    restPct: 100,
    restLabel: ''
  },

  sessionStats(session) {
    // 实时容量：Σ 次数×重量（kg），训练中随时看到「今天搬了多少铁」
    let volume = 0
    ;(session || []).forEach((item) => {
      ;(item.sets || []).forEach((st) => {
        const r = Number(st.reps)
        const w = Number(st.weight)
        if (r > 0 && w > 0) volume += Math.round(r * w)
      })
    })
    return {
      exerciseCount: (session || []).length,
      totalSets: (session || []).reduce((sum, item) => sum + ((item.sets || []).length), 0),
      sessionVolume: volume
    }
  },

  onLoad(options) {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.refreshPicker()
    if (options && options.planId) {
      this.loadPlan(options.planId)
    }
  },

  onShow() {
    // 从后台/其他页面回来：按 endAt 重算剩余，重启滴答（防漂移）
    this._clearRestTimer()
    if (this.data.restRunning && this.data.restEndAt) {
      this._tickRest()
      this._restTimerId = setInterval(() => this._tickRest(), 1000)
    }
  },

  onHide() {
    this._clearRestTimer()
  },

  onUnload() {
    this._clearRestTimer()
    if (this._restDoneTimer) clearTimeout(this._restDoneTimer)
  },

  // ===== 组间休息计时器 =====
  startRest(idx, si) {
    const ex0 = this.data.session[idx]
    if (!ex0 || !ex0.sets[si]) return
    const st = ex0.sets[si]
    const total = Math.min(rt.MAX_REST, Math.max(5, Number(st.rest) || rt.DEFAULT_REST))
    const endAt = Date.now() + total * 1000
    this._clearRestTimer()
    if (this._restDoneTimer) clearTimeout(this._restDoneTimer)
    this.setData({
      restRunning: true,
      restDone: false,
      restEndAt: endAt,
      restTotal: total,
      restRemain: total,
      restRemainText: rt.fmtTime(total),
      restPct: 100,
      restLabel: ex0.name + ' · 第 ' + (si + 1) + ' 组'
    })
    this._tickRest()
    this._restTimerId = setInterval(() => this._tickRest(), 1000)
  },

  _tickRest() {
    const now = Date.now()
    const remain = rt.remainSec(this.data.restEndAt, now)
    if (remain <= 0) {
      this.finishRest()
      return
    }
    const pct = 100 - rt.elapsedPct(this.data.restEndAt, now, this.data.restTotal)
    this.setData({ restRemain: remain, restRemainText: rt.fmtTime(remain), restPct: pct })
  },

  finishRest() {
    this._clearRestTimer()
    this.setData({ restRunning: false, restDone: true, restRemain: 0, restRemainText: '0', restPct: 0 })
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'heavy' })
      setTimeout(() => wx.vibrateShort({ type: 'heavy' }), 280)
    }
    this._restDoneTimer = setTimeout(() => this.setData({ restDone: false }), 2600)
  },

  skipRest() {
    this._clearRestTimer()
    if (this._restDoneTimer) clearTimeout(this._restDoneTimer)
    this.setData({ restRunning: false, restDone: false })
  },

  adjustRest(e) {
    const delta = Number(e.currentTarget.dataset.delta) || 0
    const remain = Math.min(rt.MAX_REST, Math.max(0, this.data.restRemain + delta))
    this.setData({
      restEndAt: Date.now() + remain * 1000,
      restTotal: remain,
      restRemain: remain,
      restRemainText: rt.fmtTime(remain),
      restPct: 100
    })
  },

  _clearRestTimer() {
    if (this._restTimerId) {
      clearInterval(this._restTimerId)
      this._restTimerId = null
    }
  },

  // 阻止面板内点击冒泡误关
  noop() {},

  // 由训练计划发起：读取计划并（去重）合并进 session
  loadPlan(planId) {
    planRepo.get(planId)
      .then((res) => {
        const plan = res && res.data ? res.data : null
        if (!plan) return
        const session = pd.mergePlanIntoSession(this.data.session, plan, ex)
        this.setData(Object.assign({
          session,
          planId: planId,
          title: plan.name || '',
          today: fmtToday()
        }, this.sessionStats(session)))
      })
      .catch((err) => {
        console.error('从计划预填失败', err)
        wx.showToast({ title: '计划加载失败', icon: 'none' })
      })
  },

  // ===== 导入训练计划（记录页内） =====
  openPlanPicker() {
    this.setData({ showPlanPicker: true })
    planRepo.list(100)
      .then((res) => {
        const list = res || []
        this.setData({
          planList: list.map((p) => ({
            _id: p._id,
            name: p.name || '未命名计划',
            count: (p.items && p.items.length) || 0
          }))
        })
      })
      .catch((err) => {
        this.setData({ showPlanPicker: false })
        wx.showToast({ title: '加载计划失败', icon: 'none' })
        console.error('加载计划列表失败', err)
      })
  },

  closePlanPicker() {
    this.setData({ showPlanPicker: false })
  },

  pickPlan(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ showPlanPicker: false })
    if (id) this.loadPlan(id)
  },

  // 取消与计划的关联（保留已填动作，随时调整）
  clearPlan() {
    this.setData({ planId: '', title: '' })
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
    this.setData(Object.assign({ session, showPicker: false }, this.sessionStats(session)))
  },

  removeExercise(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const session = this.data.session.slice()
    session.splice(idx, 1)
    this.setData(Object.assign({ session }, this.sessionStats(session)))
  },

  addSet(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const session = this.data.session.slice()
    session[idx] = Object.assign({}, session[idx])
    // 默认带出上一组的次数/重量/休息，训练中只需微调（PRD「快速 +1 录入」）
    const prevSets = session[idx].sets
    const last = prevSets.length ? prevSets[prevSets.length - 1] : null
    const next = last
      ? { reps: last.reps, weight: last.weight, rest: last.rest, completed: false }
      : blankSet()
    session[idx].sets = prevSets.concat([next])
    this.setData(Object.assign({ session }, this.sessionStats(session)))
  },

  // 练一组勾一组：完成状态切换 + 震动反馈 + 启动该组休息计时
  toggleSet(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const si = Number(e.currentTarget.dataset.sidx)
    const session = this.data.session.slice()
    session[idx] = Object.assign({}, session[idx])
    session[idx].sets = session[idx].sets.slice()
    const target = session[idx].sets[si]
    const completed = !target.completed
    session[idx].sets[si] = Object.assign({}, target, { completed })
    this.setData({ session })
    if (completed) {
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
      this.startRest(idx, si)
    }
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
    this.setData(Object.assign({ session }, this.sessionStats(session)))
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
    this.setData(Object.assign({ session }, this.sessionStats(session)))
  },

  // ===== 保存训练：先读历史最大重量（PR 检测），再写 workouts + sets =====
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
    let prevSets = []

    // PR 检测的历史基线：保存前先读一次已有 sets；失败不阻塞保存
    return workoutRepo.listSetsAll()
      .then((rows) => { prevSets = rows || [] })
      .catch((err) => { console.warn('读取历史记录失败，跳过 PR 检测', err) })
      .then(() => auth.ensureUser())
      .then(() => {
        return workoutRepo.save({
            dateStr: this.data.today,
            title: this.data.title || '',
            planId: this.data.planId || '',
            session: session
        })
      })
      .then((res) => {
        const result = res
        if (!result || !result.ok || !result.result || !result.result.workoutId) {
          throw new Error((result && result.message) || '训练事务保存失败')
        }
        return result.result
      })
      .then(() => {
        // ===== PR（个人纪录）检测：已完成组的最大重量 > 历史最大重量 =====
        const prevMax = {}
        prevSets.forEach((s) => {
          const w = Number(s.weight)
          if (w > 0 && s.exerciseName) {
            prevMax[s.exerciseName] = Math.max(prevMax[s.exerciseName] || 0, w)
          }
        })
        const prs = []
        session.forEach((s) => {
          let m = 0
          s.sets.forEach((st) => {
            if (!st.completed) return
            const w = Number(st.weight)
            if (w > m) m = w
          })
          const prev = prevMax[s.name] || 0
          if (m > 0 && prev > 0 && m > prev) prs.push({ name: s.name, weight: m, prev })
        })

        this.setData(Object.assign({ saving: false, session: [], showPicker: false }, this.sessionStats([])))
        if (prs.length) {
          const lines = prs.map((p) => p.name + '  ' + p.weight + ' kg（原 ' + p.prev + ' kg）').join('\n')
          wx.showModal({ title: '🏆 新纪录！', content: lines, showCancel: false, confirmText: '继续加油' })
        } else {
          wx.showToast({ title: '已保存', icon: 'success' })
        }
      })
      .catch((err) => {
        this.setData({ saving: false })
        wx.showToast({ title: '保存失败', icon: 'none' })
        console.error('保存训练失败', err)
      })
  }
})
