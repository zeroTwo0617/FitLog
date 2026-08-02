// Seed 测试数据生成 · 纯函数（不依赖 wx/云，便于 node 单测）
// 生成 8 周三分化训练生涯：24 次训练 + 组明细 + 3 个计划 + 8 周身体数据
// 数据设计：容量与 1RM 渐进上升、体重缓慢下降——灌入后统计页折线/1RM 趋势/日历都有像样的图
const WEEK = 7 * 24 * 3600 * 1000

function fmtDate(d) {
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// 动作模板：按周推进的渐进负荷
const TEMPLATES = {
  '练胸日': {
    exs: [
      { id: 'seed-bench', name: '杠铃卧推', nameEn: 'Barbell Bench Press', startW: 60, startR: 8, addW: 1.25 },
      { id: 'seed-oshoulder', name: '哑铃肩推', nameEn: 'Dumbbell Shoulder Press', startW: 16, startR: 10, addW: 0.75 },
      { id: 'seed-pulldown', name: '绳索下压', nameEn: 'Triceps Pushdown', startW: 20, startR: 12, addW: 1.25 },
      { id: 'seed-pushup', name: '俯卧撑', nameEn: 'Push-up', startW: 0, startR: 20, addW: 0 }
    ]
  },
  '练腿日': {
    exs: [
      { id: 'seed-squat', name: '杠铃深蹲', nameEn: 'Barbell Squat', startW: 80, startR: 8, addW: 2.5 },
      { id: 'seed-rdl', name: '罗马尼亚硬拉', nameEn: 'Romanian Deadlift', startW: 70, startR: 10, addW: 2 },
      { id: 'seed-lunge', name: '哑铃箭步蹲', nameEn: 'Dumbbell Lunge', startW: 18, startR: 12, addW: 0.75 },
      { id: 'seed-calf', name: '站姿提踵', nameEn: 'Standing Calf Raise', startW: 40, startR: 15, addW: 1.25 }
    ]
  },
  '练背日': {
    exs: [
      { id: 'seed-deadlift', name: '传统硬拉', nameEn: 'Conventional Deadlift', startW: 90, startR: 6, addW: 3.5 },
      { id: 'seed-pullup', name: '引体向上', nameEn: 'Pull-up', startW: 0, startR: 8, addW: 0 },
      { id: 'seed-brow', name: '杠铃划船', nameEn: 'Barbell Row', startW: 50, startR: 10, addW: 2 },
      { id: 'seed-curl', name: '杠铃弯举', nameEn: 'Barbell Curl', startW: 25, startR: 12, addW: 1 }
    ]
  }
}

// 第 0~7 周；每周按 周一/周三/周五 训练
function genSeed(opts) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const chartDemo = !!opts.chartDemo
  const weeks = opts.weeks || 8
  const workouts = []
  const sets = []
  const plans = []
  const bodyMetrics = []

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // 本周的周一
  const thisMonday = new Date(todayStart)
  thisMonday.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7))

  const dayNames = ['练腿日', '练胸日', '练背日'] // 周一/三/五
  const dayIdx = [0, 2, 4] // 相对周一的偏移（周一=0，周三=2，周五=4）

  let wKey = 0
  for (let w = weeks - 1; w >= 0; w--) {
    const prog = weeks - 1 - w // 训练进度：最早 0 → 现在 weeks-1（负荷随进度上升）
    // 身体数据：每周一
    const bodyDate = new Date(thisMonday)
    bodyDate.setDate(thisMonday.getDate() - w * 7)
    if (bodyDate.getTime() <= todayStart.getTime()) {
      bodyMetrics.push({
        dateStr: fmtDate(bodyDate),
        weight: Math.round((74 - w * 0.35) * 10) / 10, // 8 周前 71.6 → 现在 74
        fatPct: Math.round((20 - w * 0.4) * 10) / 10,  // 8 周前 17.2 → 现在 20
        height: 175,
        chest: Math.round((98 + prog * 0.5) * 10) / 10,
        waist: Math.round((82 - prog * 0.6) * 10) / 10,
        arm: Math.round((36 + prog * 0.4) * 10) / 10,
        thigh: Math.round((55 + prog * 0.3) * 10) / 10
      })
    }

    (chartDemo ? [0, 1, 2, 3, 4, 5] : dayIdx).forEach((offset, di) => {
      const d = new Date(thisMonday)
      d.setDate(thisMonday.getDate() - w * 7 + offset)
      if (d.getTime() > todayStart.getTime()) return // 未来日期跳过
      const title = dayNames[chartDemo ? di % dayNames.length : di]
      const tpl = TEMPLATES[title]
      const exSummaries = []
      let setTotal = 0
      tpl.exs.forEach((ex0) => {
        // 每动作 3~4 组：主项（第 1 个）4 组，其余 3 组
        const setsCount = ex0 === tpl.exs[0] ? 4 : 3
        exSummaries.push({ exerciseId: ex0.id, name: ex0.name, nameEn: ex0.nameEn, setCount: setsCount })
        for (let s = 1; s <= setsCount; s++) {
          // 渐进负荷：随进度上升；主项每组递增（末组较重）
          const weekW = ex0.startW + ex0.addW * prog
          const weight = ex0 === tpl.exs[0] ? weekW + ex0.addW * (s - 1) : weekW
          const reps = Math.max(5, ex0.startR - Math.floor(prog / 2)) // 次数随进度缓慢下降
          sets.push({
            _w: 'w' + wKey,
            exerciseId: ex0.id,
            exerciseName: ex0.name,
            setIndex: s,
            reps: reps,
            weight: weight,
            restSec: (ex0 === tpl.exs[0] ? 120 : 90),
            completed: true
          })
        }
        setTotal += setsCount
      })
      workouts.push({
        _key: 'w' + wKey,
        dateStr: fmtDate(d),
        date: d.toISOString(),
        title: title,
        planId: '',
        exercises: exSummaries,
        setTotal: setTotal
      })
      wKey++
    })
  }

  // 训练计划：3 个模板（与训练日同构）
  plans.push({
    name: '练胸日（推）',
    items: TEMPLATES['练胸日'].exs.map((e) => ({ exerciseId: e.id, exerciseName: e.name, targetSets: 4, targetReps: 8, targetWeight: e.startW + 5 }))
  })
  plans.push({
    name: '练腿日（蹲）',
    items: TEMPLATES['练腿日'].exs.map((e) => ({ exerciseId: e.id, exerciseName: e.name, targetSets: 4, targetReps: 8, targetWeight: e.startW + 10 }))
  })
  plans.push({
    name: '练背日（拉）',
    items: TEMPLATES['练背日'].exs.map((e) => ({ exerciseId: e.id, exerciseName: e.name, targetSets: 4, targetReps: 10, targetWeight: e.startW + 5 }))
  })

  return { workouts, sets, plans, bodyMetrics }
}

module.exports = { genSeed }
