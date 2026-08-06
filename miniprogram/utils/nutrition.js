const MEAL_TYPES = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '加餐' }
]
const dateUtil = require('./date.js')

function today() {
  return dateUtil.todayString()
}

function numberOrZero(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0
}

function macroCalories(protein, carbs, fat) {
  return Math.round((numberOrZero(protein) * 4 + numberOrZero(carbs) * 4 + numberOrZero(fat) * 9) * 10) / 10
}

function normalizeFood(food) {
  return {
    name: String((food && food.name) || '').trim().slice(0, 80),
    portion: String((food && food.portion) || '').trim().slice(0, 80),
    calories: numberOrZero(food && food.calories),
    protein: numberOrZero(food && food.protein),
    carbs: numberOrZero(food && food.carbs),
    fat: numberOrZero(food && food.fat),
    confidence: Math.min(1, Math.max(0, Number(food && food.confidence) || 0))
  }
}

function normalizeMeal(result, fallback) {
  const source = result || {}
  const base = fallback || {}
  const mealType = MEAL_TYPES.some((item) => item.value === source.mealType)
    ? source.mealType
    : (base.mealType || 'other')
  return {
    dateStr: /^\d{4}-\d{2}-\d{2}$/.test(source.dateStr) ? source.dateStr : (base.dateStr || today()),
    mealType,
    mealLabel: mealLabel(mealType),
    foods: Array.isArray(source.foods) ? source.foods.slice(0, 12).map(normalizeFood) : [],
    calories: numberOrZero(source.calories != null ? source.calories : source.totalCalories),
    protein: numberOrZero(source.protein != null ? source.protein : source.totalProtein),
    carbs: numberOrZero(source.carbs != null ? source.carbs : source.totalCarbs),
    fat: numberOrZero(source.fat != null ? source.fat : source.totalFat),
    source: source.source === 'photo' ? 'photo' : (source.source === 'agent' ? 'agent' : 'manual'),
    confidence: Math.min(1, Math.max(0, Number(source.confidence) || 0)),
    note: String(source.note || '热量为估算值，仅供饮食记录参考。').slice(0, 240)
  }
}

function normalizeDietPlan(plan) {
  const source = plan || {}
  const target = source.dailyTarget || {}
  const meals = Array.isArray(source.meals) ? source.meals.slice(0, 8).map((meal) => ({
    name: String((meal && meal.name) || '').trim().slice(0, 60),
    time: String((meal && meal.time) || '').trim().slice(0, 30),
    foods: Array.isArray(meal && meal.foods) ? meal.foods.slice(0, 10).map(normalizeFood) : [],
    calories: numberOrZero(meal && meal.calories)
  })) : []
  return {
    name: String(source.name || '我的饮食计划').trim().slice(0, 60),
    goal: String(source.goal || '').trim().slice(0, 80),
    dailyTarget: {
      calories: numberOrZero(target.calories),
      protein: numberOrZero(target.protein),
      carbs: numberOrZero(target.carbs),
      fat: numberOrZero(target.fat)
    },
    meals,
    constraints: Array.isArray(source.constraints)
      ? source.constraints.slice(0, 12).map((item) => String(item).slice(0, 100))
      : []
  }
}

function aggregateByDate(records) {
  const result = {}
  ;(records || []).forEach((record) => {
    if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(record.dateStr)) return
    const current = result[record.dateStr] || {
      dateStr: record.dateStr,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      mealCount: 0,
      meals: []
    }
    current.calories += numberOrZero(record.calories)
    current.protein += numberOrZero(record.protein)
    current.carbs += numberOrZero(record.carbs)
    current.fat += numberOrZero(record.fat)
    current.mealCount += 1
    current.meals.push(record)
    result[record.dateStr] = current
  })
  Object.keys(result).forEach((key) => {
    result[key].calories = Math.round(result[key].calories)
    result[key].protein = Math.round(result[key].protein * 10) / 10
    result[key].carbs = Math.round(result[key].carbs * 10) / 10
    result[key].fat = Math.round(result[key].fat * 10) / 10
  })
  return result
}

function mealLabel(value) {
  const item = MEAL_TYPES.find((entry) => entry.value === value)
  return item ? item.label : '其他'
}

module.exports = {
  MEAL_TYPES,
  today,
  normalizeFood,
  normalizeMeal,
  normalizeDietPlan,
  aggregateByDate,
  mealLabel,
  macroCalories,
  numberOrZero
}
