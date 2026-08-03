const cloud = require('../../utils/cloud.js')
const sd = require('../../utils/statsData.js')
const lc = require('../../utils/lineChart.js')
const page = require('../../utils/page.js')
const workoutRepo = require('../../utils/repositories/workout.js')

// 横轴标签：dateStr（如 2026-08-01）→ 月/日（8/1），跨月日期在横轴上也能分清
function dayLabel(dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).split('-')
  return parts.length === 3 ? Number(parts[1]) + '/' + Number(parts[2]) : String(parts[2] || '')
}

page({
  data: {
    theme: 'dark',
    loading: true,
    hasData: false,
    totalWorkouts: 0,
    totalVolume: 0,
    monthCheckins: 0,
    trend: [],
    volumeAxis: { top: 1, high: 1, mid: 1, low: 0, bottom: 0 },
    maxByExercise: [],
    ormExercises: [],   // Top 动作（可切换 1RM 趋势）
    ormActive: '',
    ormHint: '',
    activeVolume: null   // 当前选中的训练量柱子 {index, dateStr, dayLabel, volume}
  },

  getAll(collectionName, batchSize) {
    return collectionName === cloud.C.WORKOUTS
      ? workoutRepo.listAll().then((rows) => ({ data: rows }))
      : workoutRepo.listSetsAll().then((rows) => ({ data: rows }))
  },

  onShow() {
    const theme = getApp().globalData.theme || 'dark'
    this.setData({ theme })
    // 导航栏配色跟随主题，避免深色内容配白色导航栏（或浅色内容配深色导航栏）
    if (wx.setNavigationBarColor) {
      wx.setNavigationBarColor({
        frontColor: theme === 'light' ? '#000000' : '#ffffff',
        backgroundColor: theme === 'light' ? '#f5f6f1' : '#0a0c0b'
      })
    }
    this.load()
  },

  load() {
    this.setData({ loading: true })
    let requests
    try {
      requests = [this.getAll(cloud.C.WORKOUTS, 100), this.getAll(cloud.C.SETS, 100)]
    } catch (err) {
      this.handleLoadError(err)
      return
    }
    Promise.all(requests).then(([wRes, sRes]) => {
      const workouts = (wRes && wRes.data) || []
      const sets = (sRes && sRes.data) || []
      this._raw = { workouts, sets }
      const agg = sd.aggregate(workouts, sets)

      // 近 7 天训练量：固定当前日期窗口和 7 个等宽日期槽位
      const trend = sd.volumeTrend(agg, 7).map((item, index) => Object.assign({}, item, {
        showLabel: true,
        dayLabel: dayLabel(item.dateStr)
      }))
      const maxVolume = trend.reduce((max, item) => Math.max(max, Number(item.volume) || 0), 0)
      // Keep a real zero axis when no completed set has volume.
      const volumeTop = maxVolume > 0 ? Math.ceil(maxVolume / 4) * 4 : 0
      const volumeAxis = {
        top: volumeTop,
        high: Math.round(volumeTop * 0.75),
        mid: Math.round(volumeTop * 0.5),
        low: Math.round(volumeTop * 0.25),
        bottom: 0
      }

      // 本月训练日：与日历页使用同一份 workouts 日期集合
      const now = new Date()
      const ny = now.getFullYear()
      const nm = now.getMonth() + 1
      const prefix = ny + '-' + (nm < 10 ? '0' + nm : nm) + '-'
      const monthCheckins = agg.trainedDates.filter((d) => d.indexOf(prefix) === 0).length

      // 动作最大重量 Top5（带高度百分比）
      const maxW = agg.maxByExercise.length ? agg.maxByExercise[0].max : 0
      const maxByExercise = agg.maxByExercise.map((e) => Object.assign({}, e, {
        heightPct: maxW > 0 ? Math.round((e.max / maxW) * 100) : 0
      }))

      // 1RM 趋势只展示三个标准指标（卧推/硬拉/深蹲），按最大重量降序让重项在前。
      // 硬拉只取「传统硬拉」，排除罗马尼亚硬拉等辅助变体。
      const STANDARD_LIFTS = [
        { key: '卧推', exclude: [] },
        { key: '深蹲', exclude: [] },
        { key: '硬拉', exclude: ['罗马尼亚', '单腿', '直腿', '相扑'] }
      ]
      const ormExercises = (agg.allByExercise || []).slice()
        .filter((e) => STANDARD_LIFTS.some((lift) =>
          (e.name || '').indexOf(lift.key) >= 0 && !lift.exclude.some((ex) => (e.name || '').indexOf(ex) >= 0)))
        .sort((a, b) => b.max - a.max)
      const ormActive = this.data.ormActive && ormExercises.some((e) => e.name === this.data.ormActive)
        ? this.data.ormActive
        : (ormExercises.length ? ormExercises[0].name : '')
      const legacyOrmHint = ormExercises.length === 1
        ? '当前只有 1 个动作有有效重量记录'
        : ''
      const ormSeries = ormActive ? sd.oneRMTrend(workouts, sets, ormActive, 7) : []
      const ormPointCount = ormSeries.filter((item) => item.value != null).length
      const ormHint = ormPointCount === 1
        ? '当前只有 1 个已完成有效点，暂时无法形成趋势'
        : (ormPointCount === 0 ? '请在记录页填写次数和重量，并勾选完成后查看趋势' : legacyOrmHint)

      this.setData({
        loading: false,
        hasData: agg.totalWorkouts > 0,
        totalWorkouts: agg.totalWorkouts,
        totalVolume: agg.totalVolume,
        monthCheckins: monthCheckins,
        trend: trend,
        volumeAxis: volumeAxis,
        maxByExercise: maxByExercise,
        ormExercises: ormExercises,
        ormActive: ormActive,
        ormHint: ormHint
      }, () => this.drawCharts())
    }).catch((err) => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error('加载统计失败', err)
    })
  },

  handleLoadError(err) {
    this.setData({ loading: false })
    wx.showToast({ title: '云服务暂不可用', icon: 'none' })
    console.error('加载统计失败', err)
  },

  // ===== 图表绘制（canvas 2d 折线） =====
  chartColors() {
    const dark = this.data.theme !== 'light'
    return {
      color: dark ? '#c6f24e' : '#3f6b0f',
      areaTop: dark ? 'rgba(198,242,78,0.26)' : 'rgba(63,107,15,0.16)',
      areaBottom: dark ? 'rgba(198,242,78,0)' : 'rgba(63,107,15,0)',
      dotRing: dark ? '#151915' : '#ffffff',
      dimColor: dark ? '#7e8a81' : '#6a7568',
      gridColor: dark ? 'rgba(126,138,129,0.18)' : 'rgba(106,117,104,0.22)'
    }
  },

  drawInto(id, points, unit, attempt) {
    const q = wx.createSelectorQuery().in(this)
    q.select('#' + id)
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res && res[0] && res[0].node
        const w = res && res[0] && res[0].width
        const h = res && res[0] && res[0].height
        // canvas 2d 节点/尺寸初始化可能晚于渲染：节点缺失或尺寸为 0 时延迟重试
        if (!node || !w || !h) {
          const n = attempt || 0
          if (n < 6) setTimeout(() => this.drawInto(id, points, unit, n + 1), 200)
          return
        }
        const info = (wx.getWindowInfo && wx.getWindowInfo()) || { pixelRatio: 2 }
        lc.drawLineChart(node, Object.assign({
          width: w,
          height: h,
          dpr: info.pixelRatio || 2,
          points: points,
          unit: unit
        }, this.chartColors()))
      })
  },

  drawCharts() {
    if (!this.data.hasData || !this._raw) return
    // wx.nextTick：等本轮渲染完成后再查 canvas 节点，避免拿不到 node
    const draw = () => {
      this.drawOrmChart()
    }
    if (wx.nextTick) wx.nextTick(draw)
    else setTimeout(draw, 100)
  },

  drawOrmChart() {
    if (!this.data.ormActive || !this._raw) return
    // 每个动作使用自己的最近训练日作为窗口终点，避免被其他动作的新记录挤出 7 天窗口
    const series = sd.oneRMTrend(this._raw.workouts, this._raw.sets, this.data.ormActive, 7)
    const pts = series.map((s) => ({ label: dayLabel(s.dateStr), value: s.value }))
    // 切换动作时也要等本轮渲染完成再查 canvas 节点，避免拿不到 node/尺寸导致空白
    if (wx.nextTick) wx.nextTick(() => this.drawInto('ormChart', pts, 'kg'))
    else setTimeout(() => this.drawInto('ormChart', pts, 'kg'), 100)
  },

  onOrmPick(e) {
    const name = e.currentTarget.dataset.name
    if (!name || name === this.data.ormActive) return
    this.setData({ ormActive: name }, () => this.drawOrmChart())
  },

  // 点击训练量柱子：显示/收起当日容量数字
  onVolumeTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = (this.data.trend || [])[index]
    if (!item) return
    const cur = this.data.activeVolume
    const next = cur && cur.index === index
      ? null
      : { index, dateStr: item.dateStr, dayLabel: item.dayLabel, volume: Number(item.volume) || 0 }
    this.setData({ activeVolume: next })
  },

  goBody() {
    wx.navigateTo({ url: '/pages/body/body' })
  }
})
