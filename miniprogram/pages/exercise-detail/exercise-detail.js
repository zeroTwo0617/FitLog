const ex = require('../../utils/exerciseData.js')
const page = require('../../utils/page.js')

page({
  data: {
    loading: true,
    ex: null
  },
  onLoad(opts) {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    const e = ex.getById(opts.id)
    if (!e) {
      this.setData({ loading: false, ex: null })
      return
    }
    this.setData({
      loading: false,
      ex: Object.assign({}, e, { initial: e.nameZh ? e.nameZh.charAt(0) : '' })
    })
    wx.setNavigationBarTitle({ title: e.nameZh || e.name })

  }
})
