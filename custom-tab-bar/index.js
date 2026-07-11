Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
      { pagePath: '/pages/exercises/exercises', text: '动作库', icon: '💪' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '👤' }
    ]
  },
  methods: {
    switchTab(e) {
      const url = e.currentTarget.dataset.path
      const idx = e.currentTarget.dataset.index
      if (idx === this.data.selected) return
      wx.switchTab({ url })
    }
  }
})
