const INDEX = require('./exercises.index.js')

const MAX_LIMIT = 12
const MAX_QUERY_LENGTH = 120

const BODY_PART_ALIASES = {
  '\u80f8\u90e8': 'chest', '\u80cc\u90e8': 'back', '\u80a9\u90e8': 'shoulders',
  '\u624b\u81c2': 'upper arms', '\u4e0a\u81c2': 'upper arms', '\u524d\u81c2': 'lower arms',
  '\u5927\u817f': 'upper legs', '\u5c0f\u817f': 'lower legs', '\u6838\u5fc3': 'waist',
  '\u8170\u8179': 'waist', '\u6709\u6c27': 'cardio', '\u9888\u90e8': 'neck'
}

const EQUIPMENT_ALIASES = {
  '\u81ea\u91cd': 'body weight', '\u54d1\u94c3': 'dumbbell', '\u6760\u94c3': 'barbell',
  '\u9f99\u95e8\u67b6': 'cable', '\u7ef3\u7d22': 'cable', '\u5f39\u529b\u5e26': 'band',
  '\u58f6\u94c3': 'kettlebell', '\u8d1f\u91cd': 'weighted', '\u56fa\u5b9a\u5668\u68b0': 'leverage machine',
  '\u53f2\u5bc6\u65af\u673a': 'smith machine', '\u5668\u68b0': 'machine', '\u65e0\u5668\u68b0': 'none'
}

const TARGET_ALIASES = {
  '\u80f8\u808c': 'pectorals', '\u80f8\u5927\u808c': 'pectorals', '\u80cc\u9614\u808c': 'lats',
  '\u80b1\u4e8c\u5934': 'biceps', '\u80b1\u4e09\u5934': 'triceps', '\u4e09\u89d2\u808c': 'delts',
  '\u80a1\u56db\u5934': 'quads', '\u817f\u540e\u808c': 'hamstrings', '\u81c0\u808c': 'glutes',
  '\u8179\u808c': 'abs', '\u5c0f\u817f\u808c': 'calves', '\u524d\u81c2\u808c': 'forearms'
}

const BODY_PART_ZH = {
  chest: '\u80f8\u90e8', back: '\u80cc\u90e8', shoulders: '\u80a9\u90e8', 'upper arms': '\u4e0a\u81c2',
  'lower arms': '\u524d\u81c2', 'upper legs': '\u5927\u817f', 'lower legs': '\u5c0f\u817f', waist: '\u6838\u5fc3',
  cardio: '\u6709\u6c27', neck: '\u9888\u90e8'
}

const EQUIPMENT_ZH = {
  'body weight': '\u81ea\u91cd', dumbbell: '\u54d1\u94c3', barbell: '\u6760\u94c3', cable: '\u7ef3\u7d22',
  band: '\u5f39\u529b\u5e26', kettlebell: '\u58f6\u94c3', weighted: '\u8d1f\u91cd',
  'leverage machine': '\u56fa\u5b9a\u5668\u68b0', 'smith machine': '\u53f2\u5bc6\u65af\u673a',
  machine: '\u5668\u68b0', none: '\u65e0\u5668\u68b0'
}

const TARGET_ZH = {
  pectorals: '\u80f8\u808c', lats: '\u80cc\u9614\u808c', biceps: '\u80b1\u4e8c\u5934', triceps: '\u80b1\u4e09\u5934',
  delts: '\u4e09\u89d2\u808c', quads: '\u80a1\u56db\u5934', hamstrings: '\u817f\u540e\u808c', glutes: '\u81c0\u808c',
  abs: '\u8179\u808c', calves: '\u5c0f\u817f\u808c', forearms: '\u524d\u81c2\u808c'
}

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function compact(value) {
  return text(value, MAX_QUERY_LENGTH).toLowerCase().replace(/[\s,_，。/\\-]+/g, '')
}

function canonical(value, aliases) {
  const raw = text(value, 40)
  const key = compact(raw)
  return aliases[key] || raw.toLowerCase()
}

function searchable(item) {
  return [
    item.id, item.name, item.nameZh, item.bodyPart, BODY_PART_ZH[item.bodyPart],
    item.equipment, EQUIPMENT_ZH[item.equipment], item.target, TARGET_ZH[item.target], item.category
  ].filter(Boolean).map(compact).join('|')
}

function projection(item) {
  return {
    exerciseId: item.id,
    exerciseName: item.nameZh || item.name,
    exerciseNameEn: item.name,
    bodyPart: item.bodyPart,
    target: item.target,
    equipment: item.equipment
  }
}

function getById(id) {
  const value = text(id, 80)
  return INDEX.find((item) => item.id === value) || null
}

function search(options) {
  const input = options || {}
  const query = text(input.query, MAX_QUERY_LENGTH)
  const bodyPart = canonical(input.bodyPart, BODY_PART_ALIASES)
  const equipment = canonical(input.equipment, EQUIPMENT_ALIASES)
  const target = canonical(input.target, TARGET_ALIASES)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(input.limit) || 8))
  const terms = query.toLowerCase().split(/\s+/).map(compact).filter(Boolean)
  const rows = INDEX.map((item) => ({ item, haystack: searchable(item) }))
    .filter(({ item, haystack }) => {
      if (input.bodyPart && item.bodyPart !== bodyPart) return false
      if (input.equipment && item.equipment !== equipment) return false
      if (input.target && item.target !== target) return false
      return terms.length === 0 || terms.every((term) => haystack.indexOf(term) >= 0)
    })
    .map(({ item, haystack }) => {
      const queryKey = compact(query)
      let score = 0
      if (queryKey && compact(item.nameZh) === queryKey) score += 100
      if (queryKey && compact(item.name) === queryKey) score += 90
      if (queryKey && haystack.indexOf(queryKey) >= 0) score += 20
      return { item, score }
    })
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))

  return {
    query,
    filters: { bodyPart: input.bodyPart ? bodyPart : '', target: input.target ? target : '', equipment: input.equipment ? equipment : '' },
    total: rows.length,
    exercises: rows.slice(0, limit).map(({ item }) => projection(item))
  }
}

module.exports = { MAX_LIMIT, MAX_QUERY_LENGTH, getById, search }
