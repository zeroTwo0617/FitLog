const ex = require('../../utils/exerciseData.js')
const backend = require('../../utils/backend.js')

Page({
  data: {
    theme: 'dark',
    keyword: '',
    activeCat: '',
    activeCatLabel: '全部动作',
    categories: [],
    scrollTop: 0,
    list: [],
    totalCount: 0
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  onLoad() {
    this.buildCategories()
    this.refresh()
  },

  buildCategories() {
    const counts = {}
    ex.PRESET.forEach((e) => { counts[e.bodyPart] = (counts[e.bodyPart] || 0) + 1 })
    const categories = ex.categoryOptions().map((c) => ({
      key: c.key,
      label: c.label,
      count: c.key === '' ? ex.PRESET.length : (counts[c.key] || 0)
    }))
    this.setData({ categories, totalCount: ex.PRESET.length })
  },

  refresh() {
    const list = ex.list({
      keyword: this.data.keyword,
      bodyPart: this.data.activeCat
    }).map((it) => Object.assign({}, it, {
      initial: it.nameZh ? it.nameZh.charAt(0) : '',
      gif: '',
      realGif: false
    }))
    const active = this.data.categories.find((item) => item.key === this.data.activeCat)
    this.setData({
      list,
      activeCatLabel: active ? active.label : '全部动作'
    })
    this.loadMedia(list)
  },

  loadMedia(list) {
    const ids = list.map((it) => it.id)
    backend.getExerciseMediaMap(ids).then((map) => {
      const updated = list.map((it) => {
        const v = map[it.id] || {}
        let gif = ''
        let realGif = false
        if (v.available && v.url) {
          gif = backend.abs(v.url)
          realGif = true
        } else if (v.placeholder) {
          gif = backend.abs(v.placeholder)
        }
        return Object.assign({}, it, { gif, realGif })
      })
      this.setData({ list: updated })
    })
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.refresh())
  },

  onCat(e) {
    const cat = e.currentTarget.dataset.cat
    const next = this.data.activeCat === cat ? '' : cat
    this.setData({
      activeCat: next,
      scrollTop: this.data.scrollTop === 0 ? 1 : 0
    }, () => this.refresh())
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/exercise-detail/exercise-detail?id=' + id })
  }
})
