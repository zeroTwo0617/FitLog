const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'other'])

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function number(value, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return Math.round(parsed * 10) / 10
}

function food(value) {
  const item = value || {}
  const calories = number(item.calories, 0, 5000)
  const protein = number(item.protein, 0, 1000)
  const carbs = number(item.carbs, 0, 1000)
  const fat = number(item.fat, 0, 1000)
  if (!text(item.name, 80) || calories == null || protein == null || carbs == null || fat == null) return null
  return {
    name: text(item.name, 80),
    portion: text(item.portion, 80),
    calories,
    protein,
    carbs,
    fat,
    confidence: Math.min(1, Math.max(0, number(item.confidence, 0, 1) || 0))
  }
}

function planItem(value) {
  const item = value || {}
  const targetSets = number(item.targetSets, 1, 20)
  const targetReps = item.targetReps == null ? null : number(item.targetReps, 1, 100)
  const targetWeight = item.targetWeight == null ? null : number(item.targetWeight, 0, 1000)
  if (!text(item.exerciseId, 80) || !text(item.exerciseName, 100) || targetSets == null || (item.targetReps != null && targetReps == null) || (item.targetWeight != null && targetWeight == null)) return null
  return {
    exerciseId: text(item.exerciseId, 80),
    exerciseName: text(item.exerciseName, 100),
    targetSets,
    targetReps,
    targetWeight
  }
}

function validateTraining(value) {
  const payload = value || {}
  const reply = text(payload.reply, 3000)
  if (!reply) throw new Error('训练模型缺少 reply')
  let planDraft = null
  if (payload.planDraft) {
    const items = Array.isArray(payload.planDraft.items) ? payload.planDraft.items.slice(0, 12).map(planItem) : []
    if (text(payload.planDraft.name, 100) && items.length > 0 && items.every(Boolean)) {
      planDraft = { name: text(payload.planDraft.name, 100), items }
    }
  }
  return { reply, planDraft }
}

function validateDiet(value) {
  const payload = value || {}
  const reply = text(payload.reply, 3000)
  if (!reply) throw new Error('饮食模型缺少 reply')
  let dietPlanDraft = null
  const draft = payload.dietPlanDraft
  if (draft && typeof draft === 'object') {
    const target = draft.dailyTarget || {}
    const dailyTarget = {
      calories: number(target.calories, 0, 10000),
      protein: number(target.protein, 0, 1000),
      carbs: number(target.carbs, 0, 2000),
      fat: number(target.fat, 0, 1000)
    }
    const meals = Array.isArray(draft.meals) ? draft.meals.slice(0, 8).map((meal) => {
      const foods = Array.isArray(meal && meal.foods) ? meal.foods.slice(0, 10).map(food) : []
      const calories = number(meal && meal.calories, 0, 5000)
      return text(meal && meal.name, 60) && calories != null && foods.every(Boolean)
        ? { name: text(meal.name, 60), time: text(meal.time, 30), calories, foods }
        : null
    }) : []
    if (text(draft.name, 100) && Object.values(dailyTarget).every((item) => item != null) && meals.length > 0 && meals.every(Boolean)) {
      dietPlanDraft = {
        name: text(draft.name, 100),
        goal: text(draft.goal, 100),
        dailyTarget,
        meals,
        constraints: Array.isArray(draft.constraints) ? draft.constraints.slice(0, 12).map((item) => text(item, 100)) : []
      }
    }
  }
  return { reply, dietPlanDraft }
}

function validateMeal(value, requireFood) {
  const payload = value || {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.dateStr)) throw new Error('饮食日期格式不正确')
  if (!MEAL_TYPES.has(payload.mealType)) throw new Error('餐次不正确')
  const foods = Array.isArray(payload.foods) ? payload.foods.slice(0, 12).map(food) : []
  if (requireFood && (!foods.length || foods.some((item) => !item))) throw new Error('食物识别结果无效')
  const result = {
    dateStr: payload.dateStr,
    mealType: payload.mealType,
    foods: foods.filter(Boolean),
    calories: number(payload.calories != null ? payload.calories : payload.totalCalories, 0, 10000),
    protein: number(payload.protein != null ? payload.protein : payload.totalProtein, 0, 2000),
    carbs: number(payload.carbs != null ? payload.carbs : payload.totalCarbs, 0, 3000),
    fat: number(payload.fat != null ? payload.fat : payload.totalFat, 0, 1000),
    source: ['photo', 'manual', 'agent'].includes(payload.source) ? payload.source : 'manual',
    confidence: Math.min(1, Math.max(0, number(payload.confidence, 0, 1) || 0)),
    note: text(payload.note || '热量为估算值，仅供饮食记录参考。', 240)
  }
  if ([result.calories, result.protein, result.carbs, result.fat].some((item) => item == null)) throw new Error('营养数值无效')
  return result
}

module.exports = { validateTraining, validateDiet, validateMeal }
