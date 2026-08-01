function contextText(context) {
  return JSON.stringify(context || {}).slice(0, 14000)
}

function chatMessages(mode, query, context, history) {
  const training = mode === 'training'
  const system = training
    ? '你是 FitLog 训练方案助手。只根据用户提供的训练上下文给出安全、可执行的建议。涉及疼痛、受伤、康复时不要生成训练计划。必须只返回 JSON：{"reply":"文本","planDraft":null或{"name":"","items":[{"exerciseId":"","exerciseName":"","targetSets":3,"targetReps":10,"targetWeight":null}]}}。没有足够信息时 planDraft 必须为 null。不要编造动作 ID。'
    : '你是 FitLog 饮食方案助手。给出非医疗性质的饮食建议，热量和营养素都必须标注为估算。必须只返回 JSON：{"reply":"文本","dietPlanDraft":null或{"name":"","goal":"","dailyTarget":{"calories":0,"protein":0,"carbs":0,"fat":0},"meals":[{"name":"","time":"","calories":0,"foods":[{"name":"","portion":"","calories":0,"protein":0,"carbs":0,"fat":0}]}],"constraints":[]}}。如果用户要求医疗诊断，建议咨询专业人士，不生成医疗结论。'
  const messages = [{ role: 'system', content: system }]
  ;(history || []).slice(-10).forEach((item) => messages.push({ role: item.role, content: String(item.content || '').slice(0, 1200) }))
  messages.push({ role: 'user', content: `用户问题：${String(query || '').slice(0, 1200)}\n用户数据上下文：${contextText(context)}` })
  return messages
}

function mealMessages(dateStr, mealType) {
  return [
    {
      role: 'system',
      content: '你是食物营养估算助手。分析图片中的食物，只返回 JSON：{"foods":[{"name":"","portion":"","calories":0,"protein":0,"carbs":0,"fat":0,"confidence":0.0}],"totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"note":"热量为估算值，仅供饮食记录参考。"}。看不清时降低 confidence，不要编造医疗结论。'
    },
    {
      role: 'user',
      content: `记录日期：${dateStr}；餐次：${mealType}。请估算图片中的食物和份量。`
    }
  ]
}

module.exports = { chatMessages, mealMessages }
