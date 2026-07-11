const cloud = require('../../utils/cloud.js')
const hd = require('../../utils/historyData.js')

Page({
  data: {
    id: '',
    workout: null,
    groups: [],
    loading: true
  },

  onLoad(options) {
    const id = options && options.id
    if (!id) {
      wx.showToast({ title: '缺少记录ID', icon: 'none' })
      return
    }
    this.setData({ id })
    this.load(id)
  },

  load(id) {
    this.setData({ loading: true })
    const db = cloud.db()
    Promise.all([
      db.collection(cloud.C.WORKOUTS).doc(id).get(),
      db.collection(cloud.C.SETS).where({ sessionId: id }).get()
    ])
      .then(([wRes, sRes]) => {
        const workout = (wRes && wRes.data) || null
        const sets = (sRes && sRes.data) || []
        const groups = hd.buildGroups(workout, sets).map(g => ({
          exerciseId: g.exerciseId,
          name: g.name,
          nameEn: g.nameEn,
          setCount: g.setCount,
          sets: g.sets.map(s => ({
            setIndex: s.setIndex,
            repsText: (s.reps == null || s.reps === '') ? '—' : String(s.reps),
            weightText: (s.weight == null) ? '—' : (s.weight === 0 ? '自重' : (s.weight + ' kg')),
            restText: (s.restSec == null || s.restSec === '') ? '—' : (s.restSec + 's')
          }))
        }))
        this.setData({ workout, groups, loading: false })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载训练详情失败', err)
      })
  }
})
