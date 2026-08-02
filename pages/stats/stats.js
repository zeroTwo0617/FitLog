const cloud = require('../../utils/cloud.js')
const sd = require('../../utils/statsData.js')
const lc = require('../../utils/lineChart.js')

Page({
  data: {
    theme: 'dark',
    loading: true,
    hasData: false,
    totalWorkouts: 0,
    totalVolume: 0,
    monthCheckins: 0,
    trend: [],
    maxByExercise: [],
    calendar: [],
    chartNote: '',
    ormExercises: [],   // Top 动作（可切换 1RM 趋势）
    ormActive: ''
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    this.load()
  },

  load() {
    this.setData({ loading: true })
    const db = cloud.db()
    Promise.all([
      db.collection(cloud.C.WORKOUTS).limit(200).get(),
      db.collection(cloud.C.SETS).limit(1000).get()
    ]).then(([wRes, sRes]) => {
      const workouts = (wRes && wRes.data) || []
      const sets = (sRes && sRes.data) || []
      this._raw = { workouts, sets }
      const agg = sd.aggregate(workouts, sets)

      // 图表窗口锚点：最近 14 天没有数据时，自动锚定到「最近一次有数据的 14 天」，
      // 避免很久没练的用户看到两张「暂无数据」空图
      const latest = agg.trainedDates.length ? agg.trainedDates[agg.trainedDates.length - 1] : ''
      const cutoff = sd.lastNDates(14)[0]
      const chartEnd = (latest && latest < cutoff) ? latest : undefined
      this._chartEnd = chartEnd
      const chartNote = chartEnd ? '最近有数据的 14 天' : ''

      // 近 14 天训练量趋势
      const trend = sd.volumeTrend(agg, 14, chartEnd)

      // 本月打卡天数
      const now = new Date()
      const ny = now.getFullYear()
      const nm = now.getMonth() + 1
      const prefix = ny + '-' + (nm < 10 ? '0' + nm : nm) + '-'
      const monthCheckins = agg.trainedDates.filter((d) => d.indexOf(prefix) === 0).length
      const calendar = sd.buildCalendar(ny, nm, agg.trainedDates)

      // 动作最大重量 Top5（带高度百分比）
      const maxW = agg.maxByExercise.length ? agg.maxByExercise[0].max : 0
      const maxByExercise = agg.maxByExercise.map((e) => Object.assign({}, e, {
        heightPct: maxW > 0 ? Math.round((e.max / maxW) * 100) : 0
      }))

      // 1RM 趋势可切换动作（Top 3）
      const ormExercises = agg.maxByExercise.slice(0, 3)
      const ormActive = this.data.ormActive && ormExercises.some((e) => e.name === this.data.ormActive)
        ? this.data.ormActive
        : (ormExercises.length ? ormExercises[0].name : '')

      this.setData({
        loading: false,
        hasData: agg.totalWorkouts > 0,
        totalWorkouts: agg.totalWorkouts,
        totalVolume: agg.totalVolume,
        monthCheckins: monthCheckins,
        trend: trend,
        maxByExercise: maxByExercise,
        calendar: calendar,
        chartNote: chartNote,
        ormExercises: ormExercises,
        ormActive: ormActive
      }, () => this.drawCharts())
    }).catch((err) => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error('加载统计失败', err)
    })
  },

  // ===== 图表绘制（canvas 2d 折线） =====
  chartColors() {
    const dark = this.data.theme !== 'light'
    return {
      color: dark ? '#c6f24e' : '#4d7c0f',
      areaTop: dark ? 'rgba(198,242,78,0.26)' : 'rgba(77,124,15,0.16)',
      areaBottom: dark ? 'rgba(198,242,78,0)' : 'rgba(77,124,15,0)',
      dotRing: dark ? '#151915' : '#ffffff',
      dimColor: dark ? '#7e8a81' : '#9aa693'
    }
  },

  drawInto(id, points, unit, attempt) {
    const q = wx.createSelectorQuery().in(this)
    q.select('#' + id)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          // canvas 2d 节点初始化晚于普通 view，节点未就绪时延迟重试
          const n = attempt || 0
          if (n < 3) setTimeout(() => this.drawInto(id, points, unit, n + 1), 250)
          return
        }
        const info = (wx.getWindowInfo && wx.getWindowInfo()) || { pixelRatio: 2 }
        lc.drawLineChart(res[0].node, Object.assign({
          width: res[0].width,
          height: res[0].height,
          dpr: info.pixelRatio || 2,
          points: points,
          unit: unit
        }, this.chartColors()))
      })
  },

  drawCharts() {
    if (!this.data.hasData || !this._raw) return
    // 训练量：休息日置 null（折线断开，不误导为「训练量为 0」）
    const volPts = this.data.trend.map((t) => ({
      label: t.day,
      value: t.trained ? t.volume : null
    }))
    // wx.nextTick：等本轮渲染完成后再查 canvas 节点，避免拿不到 node
    const draw = () => {
      this.drawInto('volumeChart', volPts, 'kg')
      this.drawOrmChart()
    }
    if (wx.nextTick) wx.nextTick(draw)
    else setTimeout(draw, 100)
  },

  drawOrmChart() {
    if (!this.data.ormActive || !this._raw) return
    const series = sd.oneRMTrend(this._raw.workouts, this._raw.sets, this.data.ormActive, 14, this._chartEnd)
    const pts = series.map((s) => ({ label: s.day, value: s.value }))
    this.drawInto('ormChart', pts, 'kg')
  },

  onOrmPick(e) {
    const name = e.currentTarget.dataset.name
    if (!name || name === this.data.ormActive) return
    this.setData({ ormActive: name }, () => this.drawOrmChart())
  },

  goBody() {
    wx.navigateTo({ url: '/pages/body/body' })
  }
})
