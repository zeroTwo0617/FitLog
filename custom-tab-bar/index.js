const theme = require('../utils/theme.js')

Component({
  data: {
    selected: 0,
    theme: theme.getTheme(),
    list: [
      { pagePath: '/pages/index/index', text: '概览', icon: 'house' },
      { pagePath: '/pages/exercises/exercises', text: '动作库', icon: 'dumbbell' },
      { pagePath: '/pages/agent/agent', text: '教练', icon: 'sparkles' },
      { pagePath: '/pages/calendar/calendar', text: '日历', icon: 'calendar-days' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: 'user-round' }
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
      this.setData({ selected: idx })
      wx.switchTab({ url })
    }
  }
})
