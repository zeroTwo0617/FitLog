// 记录页「导入训练计划跟练」回归自测
// 覆盖：planData.planToSession 携带目标字段、按 targetSets 生成组数、mergePlanIntoSession 去重合并
const pd = require('../utils/planData.js')
const ex = { getById: (id) => ({ id, name: 'ex_' + id }) }

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg) }
  else { fail++; console.log('  ✗ ' + msg) }
}

const plan = {
  name: '练胸',
  items: [
    { exerciseId: 'a', exerciseName: '卧推', targetSets: 4, targetReps: 12, targetWeight: 60 },
    { exerciseId: 'b', exerciseName: '飞鸟', targetSets: 3, targetReps: 15, targetWeight: '' }
  ]
}

// 1) planToSession 携带目标 + 组数
const s = pd.planToSession(plan, ex)
ok(s.length === 2, 'planToSession 生成 2 个动作')
ok(s[0].targetSets === 4 && s[0].targetReps === 12 && s[0].targetWeight === 60, '目标字段已带入 session')
ok(s[1].targetWeight === '', '空目标权重保持空串')
ok(s[0].sets.length === 4 && s[1].sets.length === 3, '组数 = targetSets')
ok(s[0].sets[0].reps === '12' && s[0].sets[0].weight === '60', '每组预填目标次数/重量')

// 2) mergePlanIntoSession 去重：保留手动录入、追加计划新动作
const manual = [{ exerciseId: 'a', name: '卧推', sets: [{ reps: '10', weight: '50', rest: '' }] }]
const merged = pd.mergePlanIntoSession(manual, plan, ex)
ok(merged.length === 2, 'merge 后仍是 2 个动作（去重）')
ok(merged[0].sets[0].reps === '10' && merged[0].sets.length === 1, '手动录入的动作与组被保留')
ok(merged[1].exerciseId === 'b', '计划中的新动作已追加')

// 3) 空 session + 计划 = 仅计划动作
ok(pd.mergePlanIntoSession([], plan, ex).length === 2, '空 session 合并计划得到 2 个动作')

console.log('\n========================================')
console.log('  记录页导入计划自测：' + pass + ' 通过 / ' + fail + ' 失败')
console.log('========================================')
process.exit(fail === 0 ? 0 : 1)
