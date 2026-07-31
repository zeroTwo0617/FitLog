const ex = require('../../utils/exerciseData.js')
const backend = require('../../utils/backend.js')

Page({
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
      ex: Object.assign({}, e, {
        initial: e.nameZh ? e.nameZh.charAt(0) : '',
        gif: '',
        realGif: false
      })
    })
    wx.setNavigationBarTitle({ title: e.nameZh || e.name })

    // 从后端拿该动作图片：有则真图，无/关 API 则占位图；离线回退本地 GIF
    backend.getExerciseMedia(e.id).then((v) => {
      let gif = ''
      let realGif = false
      if (v.available && v.url) {
        gif = backend.abs(v.url)
        realGif = true
      } else if (v.placeholder) {
        gif = backend.abs(v.placeholder)
      }
      this.setData({ ex: Object.assign({}, this.data.ex, { gif, realGif }) })
    })
  }
})
