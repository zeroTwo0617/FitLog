const ex = require('../../utils/exerciseData.js')

Page({
  data: {
    count: 0
  },
  onLoad() {
    this.setData({ count: ex.PRESET.length })
  },
  goExercises() {
    wx.navigateTo({ url: '/pages/exercises/exercises' })
  }
})
