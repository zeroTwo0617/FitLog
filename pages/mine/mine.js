const auth = require('../../utils/auth.js')
const cloud = require('../../utils/cloud.js')
const theme = require('../../utils/theme.js')

Page({
  data: {
    theme: 'light',
    cloud: { status: 'pending', text: '正在同步...' },
    profile: null,
    displayName: 'FitLog 用户',
    workoutCount: 0,
    planCount: 0,
    weekDone: 0,
    goalText: '未设置',
    levelText: '未设置',
    bodySummary: {
      weight: '--',
      bmi: '--',
      date: '暂无记录'
    }
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'dark' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    this.refresh()
  },

  refresh() {
    this.setData({ 'cloud.status': 'pending', 'cloud.text': '正在同步...' })
    Promise.all([
      auth.ensureUser(),
      cloud.collection(cloud.C.WORKOUTS).count(),
      cloud.collection(cloud.C.PLANS).count(),
      cloud.collection(cloud.C.BODY).limit(1).get().catch(() => ({ data: [] })),
      cloud.collection(cloud.C.WORKOUTS).orderBy('dateStr', 'desc').limit(30).get().catch(() => ({ data: [] }))
    ]).then(([u, workoutCnt, planCnt, bodyRes, workoutListRes]) => {
      const profile = (u && u.profile) || {}
      const latestBody = bodyRes && bodyRes.data && bodyRes.data[0]
      const height = latestBody && Number(latestBody.height) > 0 ? Number(latestBody.height) / 100 : 0
      const bmi = latestBody && Number(latestBody.weight) > 0 && height > 0
        ? (Number(latestBody.weight) / (height * height)).toFixed(1)
        : '--'
      // 本周打卡天数（近 7 天有训练记录的天数）
      const trainedSet = {}
      ;(((workoutListRes && workoutListRes.data) || [])).forEach((w) => { if (w && w.dateStr) trainedSet[w.dateStr] = true })
      const p2 = (n) => (n < 10 ? '0' + n : '' + n)
      let weekDone = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        if (trainedSet[d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())]) weekDone++
      }
      this.setData({
        profile: profile,
        displayName: profile.nickName || 'FitLog 用户',
        'cloud.status': 'ok',
        'cloud.text': '云端同步正常',
        workoutCount: (workoutCnt && workoutCnt.total) || 0,
        planCount: (planCnt && planCnt.total) || 0,
        weekDone: weekDone,
        goalText: profile.goal || profile.trainingGoal || '未设置',
        levelText: profile.level || profile.trainingLevel || '未设置',
        bodySummary: {
          weight: latestBody && latestBody.weight ? `${latestBody.weight} kg` : '--',
          bmi: bmi,
          date: latestBody && latestBody.dateStr ? latestBody.dateStr : '暂无记录'
        }
      })
    }).catch((err) => {
      this.setData({
        'cloud.status': 'error',
        'cloud.text': '云端同步失败：' + ((err && err.errMsg) || '未知错误')
      })
    })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goPlans() {
    wx.navigateTo({ url: '/pages/plans/plans' })
  },

  goStats() {
    wx.navigateTo({ url: '/pages/stats/stats' })
  },

  goBody() {
    wx.navigateTo({ url: '/pages/body/body' })
  },

  goAgent() {
    wx.switchTab({ url: '/pages/agent/agent' })
  },

  // ===== 导出全部数据（JSON） =====
  // 云函数 exportData 按 _openid 聚合四集合 → 写临时文件 → 分享文件，剪贴板兜底
  exportData() {
    wx.showLoading({ title: '正在打包数据…', mask: true })
    wx.cloud.callFunction({ name: 'exportData' })
      .then((res) => {
        wx.hideLoading()
        const payload = res && res.result
        if (!payload || !payload.summary) {
          wx.showToast({ title: '导出失败', icon: 'none' })
          return
        }
        const json = JSON.stringify(payload, null, 2)
        const fs = wx.getFileSystemManager()
        const filePath = `${wx.env.USER_DATA_PATH}/fitlog-export-${Date.now()}.json`
        const clipboardFallback = () => {
          wx.setClipboardData({
            data: json,
            success: () => wx.showToast({ title: '已复制 JSON 到剪贴板', icon: 'none' }),
            fail: () => wx.showToast({ title: '导出失败', icon: 'none' })
          })
        }
        fs.writeFile({
          filePath: filePath,
          data: json,
          encoding: 'utf8',
          success: () => {
            wx.shareFileMessage({
              filePath: filePath,
              fileName: 'FitLog训练数据.json',
              success: () => {},
              fail: clipboardFallback
            })
          },
          fail: clipboardFallback
        })
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: '导出失败', icon: 'none' })
        console.error('导出失败', err)
      })
  },

  toggleTheme() {
    theme.toggle()
  }
})
