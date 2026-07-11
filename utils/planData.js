// 训练计划 / 模板 纯函数（不依赖 wx，便于单测）
// 计划数据模型（对齐 开发文档.md §5.4）：
//   plan = { _id, name, items: [{exerciseId, exerciseName, targetSets, targetReps, targetWeight}] }

// 计划 → 记录页 session（预填每组目标，组数 = targetSets）
function planToSession(plan, ex) {
  if (!plan || !Array.isArray(plan.items)) return []
  return plan.items.map((it) => {
    const ex0 = ex && typeof ex.getById === 'function' ? ex.getById(it.exerciseId) : null
    const setsCount = Math.max(1, Number(it.targetSets) || 1)
    const sets = []
    for (let i = 0; i < setsCount; i++) {
      sets.push({
        reps: (it.targetReps != null && it.targetReps !== '') ? String(it.targetReps) : '',
        weight: (it.targetWeight != null && it.targetWeight !== '') ? String(it.targetWeight) : '',
        rest: ''
      })
    }
    return {
      exerciseId: it.exerciseId,
      name: it.exerciseName,
      nameEn: ex0 ? ex0.name : '',
      sets: sets
    }
  })
}

// 计划摘要（列表卡片用）：动作数 + 动作名文本
function planSummary(plan) {
  const items = (plan && Array.isArray(plan.items)) ? plan.items : []
  const names = items.map((it) => it.exerciseName)
  const head = names.slice(0, 3)
  let namesText = head.join('、')
  if (names.length > 3) namesText += ' 等' + names.length + '项'
  if (names.length === 0) namesText = '（暂无动作）'
  return { count: names.length, namesText: namesText }
}

module.exports = { planToSession, planSummary }
