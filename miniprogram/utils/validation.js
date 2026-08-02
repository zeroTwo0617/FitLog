function finiteNumber(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function optionalRange(value, min, max, integer) {
  const number = finiteNumber(value)
  if (number == null) return { value: null, valid: true }
  return {
    value: number,
    valid: number >= min && number <= max && (!integer || Number.isInteger(number))
  }
}

function validatePlanItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) return { valid: false, message: '动作数量应为 1-30 个' }
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (!item || !item.exerciseId || !item.exerciseName) return { valid: false, message: '动作信息不完整' }
    const sets = optionalRange(item.targetSets, 1, 20, true)
    const reps = optionalRange(item.targetReps, 1, 100, true)
    const weight = optionalRange(item.targetWeight, 0, 1000, false)
    if (!sets.valid || !reps.valid || !weight.valid) return { valid: false, message: '组数、次数或重量超出合理范围' }
  }
  return { valid: true }
}

function validateBody(data) {
  const fields = [
    ['height', '身高', 50, 250],
    ['weight', '体重', 20, 400],
    ['fatPct', '体脂率', 1, 80],
    ['chest', '胸围', 20, 300],
    ['waist', '腰围', 20, 300],
    ['arm', '臂围', 5, 150],
    ['thigh', '腿围', 10, 200]
  ]
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]
    const result = optionalRange(data[field[0]], field[2], field[3], false)
    if (!result.valid) return { valid: false, message: field[1] + '超出合理范围' }
  }
  return { valid: true }
}

module.exports = { validatePlanItems, validateBody, optionalRange }
