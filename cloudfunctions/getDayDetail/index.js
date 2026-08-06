const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 一次返回某天的全部训练及其组明细，避免前端逐条查 sets（N+1）。
function fail(code, message) { return { ok: false, code, message } }

function applyOrder(query, rules) {
  if (!query || typeof query.orderBy !== 'function') return query
  return (rules || []).reduce((current, rule) => current.orderBy(rule[0], rule[1]), query)
}

const WORKOUT_ORDER = [
  ['dateStr', 'desc'],
  ['date', 'desc'],
  ['createdAt', 'desc'],
  ['_id', 'desc']
]
const SET_ORDER = [
  ['setIndex', 'asc'],
  ['createdAt', 'asc'],
  ['_id', 'asc']
]

async function getAll(collection, where, order) {
  const size = 100
  const ordered = applyOrder(db.collection(collection).where(where), order)
  const read = (skip, acc) =>
    ordered.skip(skip).limit(size).get()
      .then((res) => {
        const rows = (res && res.data) || []
        const next = acc.concat(rows)
        return rows.length < size ? next : read(skip + rows.length, next)
      })
  return read(0, [])
}

exports.main = async function (event) {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail('AUTH_REQUIRED', '请先登录微信云开发')
  const dateStr = String(event && event.dateStr || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fail('INVALID_DATE', '训练日期无效')

  try {
    const workouts = await getAll('workouts', { dateStr, _openid: openid }, WORKOUT_ORDER)
    const ids = workouts.map((w) => w._id)
    let sets = []
    // 云数据库 in 一次最多 10 个值，按批查当天所有组
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10)
      const rows = await getAll('sets', { sessionId: _.in(batch), _openid: openid }, SET_ORDER)
      sets = sets.concat(rows)
    }
    return { ok: true, workouts, sets }
  } catch (error) {
    console.error('getDayDetail failed', error)
    return fail('GET_DAY_DETAIL_FAILED', '当天训练加载失败')
  }
}
