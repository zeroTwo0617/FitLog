const cloud = require('../../utils/cloud.js')
const hd = require('../../utils/historyData.js')
const workoutData = require('../../utils/workoutData.js')
const page = require('../../utils/page.js')
const workoutRepo = require('../../utils/repositories/workout.js')

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m)
}

page({
  data: {
    theme: 'light',
    date: '',
    loading: true,
    sessions: [],
    sessionCount: 0
  },

  onLoad(options) {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    const date = (options && options.date) || ''
    if (!date) {
      wx.showToast({ title: '缺少日期', icon: 'none' })
      return
    }
    this.setData({ date })
    this.load(date)
  },

  load(date) {
    this.setData({ loading: true })
    let request
    try {
      request = workoutRepo.listAll()
    } catch (err) {
      this.handleLoadError(err)
      return
    }
    request
      .then((allWorkouts) => {
        const workouts = (allWorkouts || []).filter((workout) => workoutData.dateKey(workout) === date)
        // 倒序：新 → 旧
        workouts.sort((a, b) => {
          const ta = a.date ? new Date(a.date).getTime() : 0
          const tb = b.date ? new Date(b.date).getTime() : 0
          return tb - ta
        })
        if (workouts.length === 0) {
          this.setData({ loading: false, sessions: [], sessionCount: 0 })
          return
        }
        // 每个 session 查 SETS，构建分组
        return Promise.all(workouts.map((w, idx) =>
          workoutRepo.sets(w._id).then((data) => ({ data: data }))
            .then((sRes) => {
              const sets = (sRes && sRes.data) || []
              const groups = hd.buildGroups(w, sets).map((g) => ({
                exerciseId: g.exerciseId,
                name: g.name,
                nameEn: g.nameEn,
                setCount: g.setCount,
                sets: g.sets.map((s) => ({
                  setIndex: s.setIndex,
                  repsText: (s.reps == null || s.reps === '') ? '—' : String(s.reps),
                  weightText: (s.weight == null) ? '—' : (s.weight === 0 ? '自重' : (s.weight + ' kg')),
                  restText: (s.restSec == null || s.restSec === '') ? '—' : (s.restSec + 's')
                }))
              }))
              return {
                id: w._id,
                index: idx + 1,
                time: fmtTime(w.date),
                exerciseCount: groups.length,
                totalSets: groups.reduce((sum, g) => sum + g.setCount, 0),
                groups: groups
              }
            })
        )).then((sessions) => {
          this.setData({ loading: false, sessions: sessions, sessionCount: sessions.length })
        })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载当天训练失败', err)
      })
  },

  handleLoadError(err) {
    this.setData({ loading: false })
    wx.showToast({ title: '云服务暂不可用', icon: 'none' })
    console.error('加载当天训练失败', err)
  }
})
