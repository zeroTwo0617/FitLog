// FitLog 集中配置
// 说明：真实 AppID 已填入；云环境 env id 需替换为你在「云开发控制台 → 设置 → 环境」中看到的环境 ID。
// 未填 CLOUD_ENV 会导致 wx.cloud.init 报「环境不存在」，首页状态卡片会显示连接失败。
const config = {
  // 微信小程序 AppID（与 project.config.json 保持一致）
  APP_ID: 'wx371390f8ed0c6037',

  // 云开发环境 ID，例如 'fitlog-1g2h3k4i5j6k'
  CLOUD_ENV: 'cloud1-d6g8h90dje10f421e',

  // 云数据库集合名（统一在此维护，避免散落硬编码）
  COLLECTIONS: {
    USERS: 'users',        // 用户档案
    WORKOUTS: 'workouts',  // 训练记录（一次训练）
    SETS: 'sets',          // 组明细（一次训练的每组）
    PLANS: 'plans',        // 训练计划/模板
    BODY: 'bodyMetrics',   // 身体数据（体重/围度）
    EXERCISES: 'exercises' // 预留：后续如需把动作库 seed 到云
  }
}

module.exports = config
