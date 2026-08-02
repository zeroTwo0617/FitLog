const PRESET = require('../data/exercises.preset.js')

const BODY_PART_ZH = {
  'upper arms': '上臂', 'upper legs': '大腿', 'back': '背部', 'waist': '腰/核心',
  'chest': '胸部', 'shoulders': '肩部', 'lower legs': '小腿', 'lower arms': '前臂',
  'cardio': '有氧', 'neck': '颈部'
}

const EQUIPMENT_ZH = {
  'body weight': '自重', 'dumbbell': '哑铃', 'cable': '龙门架', 'barbell': '杠铃',
  'leverage machine': '固定器械', 'band': '弹力带', 'smith machine': '史密斯机',
  'kettlebell': '壶铃', 'weighted': '负重', 'stability ball': '瑞士球', 'ez barbell': '曲杠',
  'exercise ball': '健身球', 'medicine ball': '药球', 'e-z bar': '曲杠', 'rope': '绳',
  'roller': '泡沫轴', 'ties': '弹力带', 'machine': '器械', 'other': '其他', 'none': '无'
}

const TARGET_ZH = {
  'abs': '腹肌', 'pectorals': '胸肌', 'biceps': '肱二头', 'glutes': '臀肌',
  'delts': '三角肌', 'triceps': '肱三头', 'upper back': '上背', 'lats': '背阔肌',
  'calves': '小腿', 'quads': '股四头', 'forearms': '前臂', 'cardiovascular system': '心肺',
  'hamstrings': '腘绳肌', 'spine': '竖脊肌', 'traps': '斜方肌', 'adductors': '内收肌',
  'abductors': '外展肌', 'hips': '髋部', 'neck': '颈部'
}

function zhBodyPart(v) { return BODY_PART_ZH[v] || v || '' }
function zhEquipment(v) { return EQUIPMENT_ZH[v] || v || '' }
function zhTarget(v) { return TARGET_ZH[v] || v || '' }

function decorate(e) {
  return Object.assign({}, e, {
    bpZh: zhBodyPart(e.bodyPart),
    eqZh: zhEquipment(e.equipment),
    tgZh: zhTarget(e.target),
    nameZh: e.nameZh || e.name
  })
}

function list(opts) {
  opts = opts || {}
  const keyword = (opts.keyword || '').trim().toLowerCase()
  const bodyPart = opts.bodyPart || ''
  const equipment = opts.equipment || ''
  let arr = PRESET
  if (bodyPart) arr = arr.filter(e => e.bodyPart === bodyPart)
  if (equipment) arr = arr.filter(e => e.equipment === equipment)
  if (keyword) {
    arr = arr.filter(e =>
      (e.name && e.name.toLowerCase().indexOf(keyword) >= 0) ||
      (e.nameZh && e.nameZh.indexOf(keyword) >= 0) ||
      (e.target && e.target.toLowerCase().indexOf(keyword) >= 0) ||
      (e.bodyPart && e.bodyPart.toLowerCase().indexOf(keyword) >= 0)
    )
  }
  return arr.map(decorate)
}

function getById(id) {
  const e = PRESET.find(x => x.id === id)
  return e ? decorate(e) : null
}

function categoryOptions() {
  const all = [
    ['', '全部'], ['chest', '胸部'], ['back', '背部'], ['shoulders', '肩部'],
    ['upper arms', '上臂'], ['upper legs', '大腿'], ['waist', '腰/核心'],
    ['lower legs', '小腿'], ['lower arms', '前臂'], ['cardio', '有氧'], ['neck', '颈部']
  ]
  return all.map(([key, label]) => ({ key, label }))
}

module.exports = {
  PRESET,
  zhBodyPart,
  zhEquipment,
  zhTarget,
  list,
  getById,
  categoryOptions
}
