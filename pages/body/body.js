const cloud = require('../../utils/cloud.js')
const auth = require('../../utils/auth.js')
const sd = require('../../utils/statsData.js')

function fmtToday() {
  const d = new Date()
  const p = (x) => (x < 10 ? '0' + x : '' + x)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

Page({
  data: {
    date: fmtToday(),
    dateStr: fmtToday(),
    weight: '',
    fatPct: '',
    chest: '',
    waist: '',
    arm: '',
    thigh: '',
    note: '',
    saving: false,
    records: [],
    trend: [],
    hasData: false
  },

  onShow() {
    this.load()
  },

  load() {
    const db = cloud.db()
    db.collection(cloud.C.BODY).limit(100).get()
      .then((res) => {
        const records = (res && res.data) || []
        const sorted = records.slice().sort((a, b) => (a.dateStr < b.dateStr ? 1 : -1)) // 倒序，最新在前
        const trend = sd.bodyTrend(records, 'weight')
        this.setData({
          records: sorted,
          trend: trend,
          hasData: sorted.length > 0
        })
      })
      .catch((err) => {
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载身体数据失败', err)
      })
  },

  onDate(e) {
    const date = e.detail.value
    this.setData({ date: date, dateStr: date })
  },

  onWeight(e) { this.setData({ weight: e.detail.value }) },
  onFat(e) { this.setData({ fatPct: e.detail.value }) },
  onChest(e) { this.setData({ chest: e.detail.value }) },
  onWaist(e) { this.setData({ waist: e.detail.value }) },
  onArm(e) { this.setData({ arm: e.detail.value }) },
  onThigh(e) { this.setData({ thigh: e.detail.value }) },
  onNote(e) { this.setData({ note: e.detail.value }) },

  save() {
    if (this.data.saving) return
    const d = this.data
    const hasAny = d.weight !== '' || d.fatPct !== '' || d.chest !== '' || d.waist !== '' || d.arm !== '' || d.thigh !== ''
    if (!hasAny) {
      wx.showToast({ title: '至少填一项', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const db = cloud.db()
    const rec = {
      date: new Date(d.date),
      dateStr: d.dateStr,
      weight: d.weight === '' ? null : Number(d.weight),
      fatPct: d.fatPct === '' ? null : Number(d.fatPct),
      chest: d.chest === '' ? null : Number(d.chest),
      waist: d.waist === '' ? null : Number(d.waist),
      arm: d.arm === '' ? null : Number(d.arm),
      thigh: d.thigh === '' ? null : Number(d.thigh),
      note: d.note || '',
      createdAt: new Date()
    }
    auth.ensureUser()
      .then(() => db.collection(cloud.C.BODY).add({ data: rec }))
      .then(() => {
        this.setData({
          saving: false,
          weight: '', fatPct: '', chest: '', waist: '', arm: '', thigh: '', note: ''
        })
        wx.showToast({ title: '已保存', icon: 'success' })
        this.load()
      })
      .catch((err) => {
        this.setData({ saving: false })
        wx.showToast({ title: '保存失败', icon: 'none' })
        console.error('保存身体数据失败', err)
      })
  }
})
