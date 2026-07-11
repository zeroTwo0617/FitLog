// 云数据库访问封装。必须在 app.js 中 wx.cloud.init 之后使用。
const config = require('./config.js')

// 惰性获取数据库实例（避免未初始化时提前 require 报错）
function db() {
  if (!wx.cloud || !wx.cloud.database) {
    throw new Error('云环境未初始化，请确认 app.js 已调用 wx.cloud.init')
  }
  return wx.cloud.database()
}

function collection(name) {
  return db().collection(name)
}

module.exports = {
  db,
  collection,
  C: config.COLLECTIONS // 集合名快捷引用
}
