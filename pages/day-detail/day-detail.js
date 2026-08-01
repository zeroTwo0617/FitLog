const cloud = require('../../utils/cloud.js')
const hd = require('../../utils/historyData.js')

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m)
}

Page({
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
    const db = cloud.db()
    db.collection(cloud.C.WORKOUTS).where({ dateStr: date }).get()
      .then((wRes) => {
        const workouts = (wRes && wRes.data) || []
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
          db.collection(cloud.C.SETS).where({ sessionId: w._id }).get()
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
  }
})
