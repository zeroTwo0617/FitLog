const theme = require('../utils/theme.js')

Component({
  data: {
    selected: 0,
    theme: theme.getTheme(),
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '◉' },
      { pagePath: '/pages/exercises/exercises', text: '动作', icon: '◎' },
      { pagePath: '/pages/calendar/calendar', text: '日历', icon: '◌' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '◍' }
    ]
  },

  pageLifetimes: {
    show() {
      this.setData({ theme: theme.getTheme() })
    }
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
