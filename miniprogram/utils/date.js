const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000

function shifted(value) {
  const source = value instanceof Date ? value : new Date(value == null ? Date.now() : value)
  return new Date(source.getTime() + CHINA_OFFSET_MS)
}

function parts(value) {
  const date = shifted(value)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay()
  }
}

function pad(value) { return value < 10 ? '0' + value : String(value) }

function formatParts(value) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`
}

function todayString() { return formatParts(parts(new Date())) }

function dateString(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return formatParts(parts(value))
}

function parseDateString(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function addDaysString(value, days) {
  const date = parseDateString(value)
  if (!date) return ''
  date.setUTCDate(date.getUTCDate() + Number(days || 0))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function offsetDateString(days) { return addDaysString(todayString(), days) }

function timeString(value) {
  const date = shifted(value)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

module.exports = { parts, todayString, dateString, parseDateString, addDaysString, offsetDateString, timeString }
