const cloud = require('../../utils/cloud.js')
const auth = require('../../utils/auth.js')
const sd = require('../../utils/statsData.js')
const lc = require('../../utils/lineChart.js')
const page = require('../../utils/page.js')
const validation = require('../../utils/validation.js')
const bodyRepo = require('../../utils/repositories/body.js')
const dateUtil = require('../../utils/date.js')

function fmtToday() {
  return dateUtil.todayString()
}

function buildTrendSummary(trend) {
  const values = (trend || []).map((item) => Number(item.value)).filter((value) => value > 0)
  if (!values.length) {
    return { latest: '--', first: '--', min: '--', max: '--', change: '暂无变化', tone: 'flat' }
  }
  const first = values[0]
  const latest = values[values.length - 1]
  const change = latest - first
  return {
    latest: latest.toFixed(1),
    first: first.toFixed(1),
    min: Math.min.apply(null, values).toFixed(1),
    max: Math.max.apply(null, values).toFixed(1),
    change: values.length > 1 ? `${change > 0 ? '+' : ''}${change.toFixed(1)} kg` : '首次记录',
    tone: change < -0.05 ? 'down' : (change > 0.05 ? 'up' : 'flat')
  }
}

page({
  data: {
    date: fmtToday(),
    dateStr: fmtToday(),
    height: '',
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
    trendSummary: { latest: '--', first: '--', min: '--', max: '--', change: '暂无变化', tone: 'flat' },
    hasData: false
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.load()
  },

  load() {
    bodyRepo.listAll()
      .then((records) => {
        // 每天一条：同一天保留最新（updatedAt/createdAt 靠后）的一条，兼容存量重复数据
        const byDate = {}
        ;(records || []).forEach((r) => {
          const key = r.dateStr || ''
          const prev = byDate[key]
          const prevTime = prev && (new Date(prev.updatedAt || prev.createdAt || 0).getTime())
          const curTime = new Date(r.updatedAt || r.createdAt || 0).getTime()
          if (!prev || curTime >= prevTime) byDate[key] = r
        })
        const deduped = Object.keys(byDate).map((k) => byDate[k])
        const sorted = deduped.slice().sort((a, b) => (a.dateStr < b.dateStr ? 1 : -1)).map((r) => {
          // 由身高+体重派生 BMI（仅当两项齐全时）
          let bmi = ''
          if (r.weight && r.height) {
            const h = Number(r.height) / 100
            bmi = (Number(r.weight) / (h * h)).toFixed(1)
          }
          return Object.assign({}, r, { bmi: bmi })
        }) // 倒序，最新在前
        const trend = sd.bodyTrend(deduped, 'weight').filter((item) => item.value > 0)
        this.setData({
          records: sorted,
          trend: trend,
          trendSummary: buildTrendSummary(trend),
          hasData: sorted.length > 0
        }, () => this.drawWeightChart())
      })
      .catch((err) => {
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载身体数据失败', err)
      })
  },

  drawWeightChart(attempt) {
    if (!this.data.trend || this.data.trend.length < 2) return
    const query = wx.createSelectorQuery().in(this)
    query.select('#weightChart').fields({ node: true, size: true }).exec((res) => {
      const item = res && res[0]
      const node = item && item.node
      const width = item && item.width
      const height = item && item.height
      if (!node || !width || !height) {
        const retry = attempt || 0
        if (retry < 6) setTimeout(() => this.drawWeightChart(retry + 1), 180)
        return
      }
      const info = (wx.getWindowInfo && wx.getWindowInfo()) || { pixelRatio: 2 }
      const dark = this.data.theme !== 'light'
      lc.drawLineChart(node, {
        width: width,
        height: height,
        dpr: info.pixelRatio || 2,
        points: this.data.trend.map((point) => ({ label: point.dateStr.slice(5), value: point.value })),
        unit: 'kg',
        color: dark ? '#c6f24e' : '#3f6b0f',
        dimColor: dark ? '#8a958e' : '#6a7568',
        gridColor: dark ? 'rgba(126,138,129,0.18)' : 'rgba(106,117,104,0.22)',
        areaTop: dark ? 'rgba(198,242,78,0.22)' : 'rgba(63,107,15,0.16)',
        areaBottom: dark ? 'rgba(198,242,78,0)' : 'rgba(63,107,15,0)'
      })
    })
  },

  onDate(e) {
    const date = e.detail.value
    this.setData({ date: date, dateStr: date })
  },

  onWeight(e) { this.setData({ weight: e.detail.value }) },
  onHeight(e) { this.setData({ height: e.detail.value }) },
  onFat(e) { this.setData({ fatPct: e.detail.value }) },
  onChest(e) { this.setData({ chest: e.detail.value }) },
  onWaist(e) { this.setData({ waist: e.detail.value }) },
  onArm(e) { this.setData({ arm: e.detail.value }) },
  onThigh(e) { this.setData({ thigh: e.detail.value }) },
  onNote(e) { this.setData({ note: e.detail.value }) },

  save() {
    if (this.data.saving) return
    const d = this.data
    const hasAny = d.height !== '' || d.weight !== '' || d.fatPct !== '' || d.chest !== '' || d.waist !== '' || d.arm !== '' || d.thigh !== ''
    if (!hasAny) {
      wx.showToast({ title: '至少填一项', icon: 'none' })
      return
    }
    const validationResult = validation.validateBody(d)
    if (!validationResult.valid) {
      wx.showToast({ title: validationResult.message, icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const rec = {
      dateStr: d.dateStr,
      height: d.height === '' ? null : Number(d.height),
      weight: d.weight === '' ? null : Number(d.weight),
      fatPct: d.fatPct === '' ? null : Number(d.fatPct),
      chest: d.chest === '' ? null : Number(d.chest),
      waist: d.waist === '' ? null : Number(d.waist),
      arm: d.arm === '' ? null : Number(d.arm),
      thigh: d.thigh === '' ? null : Number(d.thigh),
      note: d.note || ''
    }
    auth.ensureUser()
      .then(() => bodyRepo.save(rec))
      .then(() => {
        this.setData({
          saving: false,
          height: '', weight: '', fatPct: '', chest: '', waist: '', arm: '', thigh: '', note: ''
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
