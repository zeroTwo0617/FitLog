const cloud = require('../../utils/cloud.js')
const sd = require('../../utils/statsData.js')
const hd = require('../../utils/historyData.js')
const nutrition = require('../../utils/nutrition.js')

function fmtNow() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

Page({
  data: {
    theme: 'light',
    loading: true,
    calYear: 0,
    calMonth: 0,
    calendar: [],
    canPrev: true,
    canNext: false,
    trainedDays: 0,
    workoutCount: 0,
    monthWorkoutCount: 0,
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    selectedDate: '',
    selectedWorkouts: [],
    selectedSessionCount: 0,
    selectedExerciseCount: 0,
    selectedSetCount: 0,
    detailLoading: false,
    monthCalories: 0,
    selectedNutrition: null,
    dailyTargetCalories: 0
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.load()
  },

  load() {
    const previousSelectedDate = this.data.selectedDate
    this.setData({ loading: true })
    const db = cloud.db()
    Promise.all([
      db.collection(cloud.C.WORKOUTS).limit(200).get(),
      db.collection(cloud.C.NUTRITION_LOGS).limit(500).get().catch(() => ({ data: [] })),
      db.collection(cloud.C.DIET_PLANS).orderBy('updatedAt', 'desc').limit(1).get().catch(() => ({ data: [] }))
    ]).then(([res, nutritionRes, dietPlanRes]) => {
        const list = (res && res.data) || []
        const countMap = {}
        list.forEach((w) => {
          const d = w.dateStr
          if (d) countMap[d] = (countMap[d] || 0) + 1
        })
        this._trained = Object.keys(countMap)
        this._countMap = countMap
        this._workouts = list
        this._nutritionRecords = ((nutritionRes && nutritionRes.data) || []).map((item) => Object.assign({}, item, {
          mealTypeLabel: nutrition.mealLabel(item.mealType)
        }))
        this._nutritionByDate = nutrition.aggregateByDate(this._nutritionRecords)
        const latestPlan = dietPlanRes && dietPlanRes.data && dietPlanRes.data[0]
        this._dailyTargetCalories = Number(latestPlan && latestPlan.dailyTarget && latestPlan.dailyTarget.calories) || 0
        const { year, month } = fmtNow()
        this.setData({
          loading: false,
          workoutCount: list.length,
          trainedDays: this._trained.length,
          selectedDate: '',
          selectedWorkouts: [],
          selectedNutrition: null,
          dailyTargetCalories: this._dailyTargetCalories
        }, () => {
          this.renderCalendar(year, month)
          if (previousSelectedDate) {
            this.tapDay({ currentTarget: { dataset: { date: previousSelectedDate } } })
          }
        })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        console.error('加载日历失败', err)
      })
  },

  renderCalendar(year, month) {
    if (!this._trained) return
    const cells = sd.buildCalendar(year, month, this._trained)
    const decorated = cells.map((c) => Object.assign({}, c, {
      count: (c.dateStr && this._countMap[c.dateStr]) || 0,
      calories: (c.dateStr && this._nutritionByDate[c.dateStr] && this._nutritionByDate[c.dateStr].calories) || 0,
      mealCount: (c.dateStr && this._nutritionByDate[c.dateStr] && this._nutritionByDate[c.dateStr].mealCount) || 0,
      calorieStatus: this._dailyTargetCalories > 0 && c.dateStr && this._nutritionByDate[c.dateStr]
        ? (this._nutritionByDate[c.dateStr].calories <= this._dailyTargetCalories ? 'under' : 'over')
        : ''
    }))
    const now = fmtNow()
    const canNext = !(year > now.year || (year === now.year && month >= now.month))
    const monthPrefix = `${year}-${month < 10 ? `0${month}` : month}-`
    const monthWorkoutCount = (this._workouts || []).filter((item) => (item.dateStr || '').indexOf(monthPrefix) === 0).length
    const monthCalories = Object.keys(this._nutritionByDate || {})
      .filter((date) => date.indexOf(monthPrefix) === 0)
      .reduce((sum, date) => sum + (this._nutritionByDate[date].calories || 0), 0)
    this.setData({
      calendar: decorated,
      calYear: year,
      calMonth: month,
      canPrev: true,
      canNext,
      monthWorkoutCount,
      monthCalories
    })
  },

  prevMonth() {
    if (!this.data.canPrev) return
    let y = this.data.calYear
    let m = this.data.calMonth - 1
    if (m < 1) { m = 12; y -= 1 }
    this.renderCalendar(y, m)
  },

  nextMonth() {
    if (!this.data.canNext) return
    let y = this.data.calYear
    let m = this.data.calMonth + 1
    if (m > 12) { m = 1; y += 1 }
    this.renderCalendar(y, m)
  },

  tapDay(e) {
    const ds = e.currentTarget.dataset.date
    if (!ds) return
    if (this.data.selectedDate === ds) {
      this.setData({ selectedDate: '', selectedWorkouts: [], selectedNutrition: null })
      return
    }

    const workouts = (this._workouts || [])
      .filter((item) => item.dateStr === ds)
      .sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0
        const tb = b.date ? new Date(b.date).getTime() : 0
        return tb - ta
      })

    this.setData({
      selectedDate: ds,
      selectedWorkouts: [],
      selectedSessionCount: workouts.length,
      selectedExerciseCount: workouts.reduce((sum, item) => sum + ((item.exercises || []).length), 0),
      selectedSetCount: workouts.reduce((sum, item) => sum + (Number(item.setTotal) || 0), 0),
      detailLoading: workouts.length > 0,
      selectedNutrition: (this._nutritionByDate && this._nutritionByDate[ds]) || null
    })

    if (workouts.length === 0) return

    const db = cloud.db()
    Promise.all(workouts.map((workout, index) =>
      db.collection(cloud.C.SETS).where({ sessionId: workout._id }).get()
        .then((res) => {
          const sets = (res && res.data) || []
          const groups = hd.buildGroups(workout, sets).map((group) => ({
            exerciseId: group.exerciseId,
            name: group.name,
            setCount: group.setCount,
            sets: group.sets.map((set) => ({
              setIndex: set.setIndex,
              repsText: (set.reps == null || set.reps === '') ? '—' : String(set.reps),
              weightText: (set.weight == null) ? '—' : (set.weight === 0 ? '自重' : (set.weight + ' kg')),
              restText: (set.restSec == null || set.restSec === '') ? '—' : (set.restSec + 's')
            }))
          }))
          return {
            id: workout._id,
            index: index + 1,
            title: workout.title || '训练记录',
            time: workout.date ? new Date(workout.date).toTimeString().slice(0, 5) : '',
            exerciseCount: groups.length,
            totalSets: groups.reduce((sum, group) => sum + group.setCount, 0),
            groups
          }
        })
    )).then((selectedWorkouts) => {
      if (this.data.selectedDate !== ds) return
      this.setData({ selectedWorkouts, detailLoading: false })
    }).catch((err) => {
      if (this.data.selectedDate !== ds) return
      this.setData({ detailLoading: false })
      wx.showToast({ title: '当天详情加载失败', icon: 'none' })
      console.error('加载当天训练详情失败', err)
    })
  },

  openNutrition(e) {
    const date = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.date) || this.data.selectedDate
    if (!date) return
    wx.navigateTo({ url: `/pages/nutrition/nutrition?date=${date}` })
  }
})
