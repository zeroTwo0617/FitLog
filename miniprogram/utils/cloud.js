// 云数据库访问封装。必须在 app.js 中 wx.cloud.init 之后使用。
const config = require('./config.js')

// 惰性获取数据库实例（避免未初始化时提前 require 报错）
function db() {
  if (!wx.cloud || !wx.cloud.database) {
    throw new Error('云环境未初始化，请确认 app.js 已调用 wx.cloud.init')
  }
  return wx.cloud.database()
}

function isReady() {
  return !!(wx.cloud && wx.cloud.database)
}

function collection(name) {
  return db().collection(name)
}

function callFunction(name, data) {
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    return Promise.reject(new Error('云环境未初始化'))
  }
  return wx.cloud.callFunction({ name: name, data: data || {} }).then((res) => {
    const result = res && res.result ? res.result : res
    if (result && result.ok === false) {
      const error = new Error(result.error && result.error.message || result.message || '云操作失败')
      error.code = result.error && result.error.code || result.code || 'CLOUD_OPERATION_FAILED'
      throw error
    }
    return result
  })
}

// 分页读取集合，避免页面使用固定 limit 后在数据增长时静默截断。
// 注意：小程序端 SDK 单次 get() 有 20 条上限，size 需设为安全值。
// 分页策略：第一页串行判断是否还有更多；后续每批最多 PARALLEL_BATCH 页并行，
// 批内出现不满页即到底。相比逐页串行，大数据量下往返次数显著减少。
const PARALLEL_BATCH = 5
function getAll(name, batchSize) {
  const size = batchSize > 0 && batchSize <= 20 ? batchSize : 20
  const database = db()
  const col = database.collection(name)
  const page = (skip) => {
    const q = typeof col.skip === 'function' ? col.skip(skip).limit(size) : col.limit(size)
    return q.get().then((res) => (res && res.data) || [])
  }
  const fetchBatch = (startSkip, acc) => {
    const pending = []
    for (let i = 0; i < PARALLEL_BATCH; i++) pending.push(page(startSkip + i * size))
    return Promise.all(pending).then((pages) => {
      let combined = acc
      let reachedEnd = false
      pages.forEach((rows) => {
        combined = combined.concat(rows)
        if (rows.length < size) reachedEnd = true
      })
      return reachedEnd ? combined : fetchBatch(startSkip + PARALLEL_BATCH * size, combined)
    })
  }
  return page(0).then((first) => (first.length < size ? first : fetchBatch(size, first)))
}

module.exports = {
  db,
  isReady,
  collection,
  callFunction,
  getAll,
  C: config.COLLECTIONS // 集合名快捷引用
}
