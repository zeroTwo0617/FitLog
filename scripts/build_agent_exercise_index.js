const fs = require('fs')
const path = require('path')

const sourcePath = path.join(__dirname, '..', 'miniprogram', 'data', 'exercises.preset.js')
const outputPath = path.join(__dirname, '..', 'cloudfunctions', 'agent', 'exercises.index.js')
const source = require(sourcePath)

if (!Array.isArray(source) || source.length === 0) {
  throw new Error('Exercise preset is empty or invalid')
}

const ids = new Set()
const index = source.map((item) => {
  const id = String(item && item.id || '').trim()
  if (!id || ids.has(id)) throw new Error(`Duplicate or empty exercise id: ${id}`)
  ids.add(id)
  return {
    id,
    name: String(item.name || '').trim(),
    nameZh: String(item.nameZh || '').trim(),
    bodyPart: String(item.bodyPart || '').trim(),
    equipment: String(item.equipment || '').trim(),
    target: String(item.target || '').trim(),
    category: String(item.category || '').trim()
  }
})

const banner = '// Generated from miniprogram/data/exercises.preset.js. Do not edit by hand.\n'
fs.writeFileSync(outputPath, `${banner}module.exports = ${JSON.stringify(index)}\n`, 'utf8')
console.log(`Generated ${index.length} exercise index records at ${outputPath}`)
