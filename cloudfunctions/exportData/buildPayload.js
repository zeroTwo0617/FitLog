// 导出数据 · 纯函数：四集合 → 导出载荷（便于 node 单测，云函数与文档结构一致）
function buildPayload(data) {
  const workouts = data.workouts || []
  const sets = data.sets || []
  const plans = data.plans || []
  const bodyMetrics = data.bodyMetrics || []
  return {
    app: 'FitLog',
    version: 1,
    exportedAt: new Date().toISOString(),
    summary: {
      workouts: workouts.length,
      sets: sets.length,
      plans: plans.length,
      bodyMetrics: bodyMetrics.length
    },
    workouts: workouts,
    sets: sets,
    plans: plans,
    bodyMetrics: bodyMetrics
  }
}

module.exports = { buildPayload }
