// 训练历史的数据整理工具（纯函数，便于 node 单测，不依赖 wx / 云）
function sortWorkouts(list) {
  if (!Array.isArray(list)) return []
  return list.slice().sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0
    const tb = b.date ? new Date(b.date).getTime() : 0
    return tb - ta // 倒序：新 → 旧
  })
}

// 把 workout 概要 + 其 sets 整理成分组结构（按 workout.exercises 顺序，组内切按 setIndex 升序）
function buildGroups(workout, sets) {
  const list = (sets || []).slice()
  list.sort((a, b) => (a.setIndex || 0) - (b.setIndex || 0))

  const exercises = (workout && workout.exercises) || []
  const map = {}
  list.forEach(s => {
    if (!map[s.exerciseId]) map[s.exerciseId] = []
    map[s.exerciseId].push(s)
  })

  const groups = exercises.map(ex0 => ({
    exerciseId: ex0.exerciseId,
    name: ex0.name || (map[ex0.exerciseId] && map[ex0.exerciseId][0] && map[ex0.exerciseId][0].exerciseName) || '',
    nameEn: ex0.nameEn || '',
    setCount: (map[ex0.exerciseId] || []).length,
    sets: map[ex0.exerciseId] || []
  }))

  // 兜底：workout.exercises 缺失时，用 sets 里出现的 exerciseId 还原分组
  if (groups.length === 0 && list.length > 0) {
    const seen = {}
    list.forEach(s => {
      if (seen[s.exerciseId]) return
      seen[s.exerciseId] = true
      groups.push({
        exerciseId: s.exerciseId,
        name: s.exerciseName || '',
        nameEn: '',
        setCount: 0,
        sets: list.filter(x => x.exerciseId === s.exerciseId)
      })
    })
  }
  return groups
}

module.exports = { sortWorkouts, buildGroups }
