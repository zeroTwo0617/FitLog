const theme = require('../utils/theme.js')

Component({
  data: {
    selected: 0,
    theme: theme.getTheme(),
    list: [
      { pagePath: '/pages/index/index', text: '概览', icon: 'home' },
      { pagePath: '/pages/exercises/exercises', text: '动作库', icon: 'library' },
      { pagePath: '/pages/agent/agent', text: '教练', icon: 'spark' },
      { pagePath: '/pages/calendar/calendar', text: '日历', icon: 'calendar' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: 'profile' }
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
      const idx = Number(e.currentTarget.dataset.index)
      if (idx === this.data.selected) return
      wx.switchTab({ url })
    }
  }
})
