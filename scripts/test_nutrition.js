const assert = require('assert')
const nutrition = require('../miniprogram/utils/nutrition.js')
const schemas = require('../cloudfunctions/agent/schemas.js')

const records = [
  { _id: 'a', dateStr: '2026-08-01', mealType: 'breakfast', calories: 400, protein: 20, carbs: 50, fat: 12 },
  { _id: 'b', dateStr: '2026-08-01', mealType: 'lunch', calories: 650, protein: 32, carbs: 72, fat: 18 },
  { _id: 'c', dateStr: '2026-08-02', mealType: 'snack', calories: 180, protein: 8, carbs: 20, fat: 7 }
]
const daily = nutrition.aggregateByDate(records)
assert.strictEqual(daily['2026-08-01'].calories, 1050)
assert.strictEqual(daily['2026-08-01'].mealCount, 2)
assert.strictEqual(daily['2026-08-01'].protein, 52)
assert.strictEqual(nutrition.mealLabel('dinner'), '晚餐')

const meal = schemas.validateMeal({
  dateStr: '2026-08-01', mealType: 'lunch', source: 'photo',
  foods: [{ name: '米饭', portion: '一碗', calories: 260, protein: 5, carbs: 58, fat: 1 }],
  calories: 260, protein: 5, carbs: 58, fat: 1
}, true)
assert.strictEqual(meal.foods.length, 1)
assert.throws(() => schemas.validateMeal({ dateStr: '2026-08-01', mealType: 'lunch', foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 }, true))
assert.throws(() => schemas.validateMeal({ dateStr: '2026-02-30', mealType: 'lunch', foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 }, false), /Invalid meal date/)
assert.throws(() => schemas.validateMeal({ dateStr: '2999-01-01', mealType: 'lunch', foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 }, false), /Invalid meal date/)

const originalNow = Date.now
Date.now = () => Date.UTC(2026, 7, 5, 15, 59, 0)
assert.strictEqual(schemas.isDateStr('2026-08-05'), true)
assert.strictEqual(schemas.isDateStr('2026-08-06'), false)
Date.now = () => Date.UTC(2026, 7, 5, 16, 1, 0)
assert.strictEqual(schemas.isDateStr('2026-08-06'), true)
Date.now = originalNow

const training = schemas.validateTraining({ reply: '建议逐步增加训练量', planDraft: { name: '训练计划', items: [{ exerciseId: '0001', exerciseName: '深蹲', targetSets: 3, targetReps: 8, targetWeight: null }] } })
assert.strictEqual(training.planDraft.items[0].targetSets, 3)
const invalidPlan = schemas.validateTraining({ reply: '可以继续观察', planDraft: { name: '坏计划', items: [{ exerciseId: '', exerciseName: '', targetSets: 99, targetReps: 0 }] } })
assert.strictEqual(invalidPlan.planDraft, null)

const diet = schemas.validateDiet({ reply: '建议均衡饮食', dietPlanDraft: {
  name: '工作日饮食', goal: '减脂',
  dailyTarget: { calories: 1800, protein: 130, carbs: 180, fat: 55 },
  meals: [{ name: '早餐', time: '08:00', calories: 450, foods: [{ name: '鸡蛋', portion: '2个', calories: 140, protein: 12, carbs: 1, fat: 10 }] }],
  constraints: ['少油']
}})
assert.strictEqual(diet.dietPlanDraft.dailyTarget.calories, 1800)

console.log('Nutrition aggregation and agent schema tests passed')
