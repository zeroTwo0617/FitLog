Page({
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },
  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  }
})
