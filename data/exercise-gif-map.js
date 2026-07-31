// 动作 GIF 1:1 映射
//
// 数据源：hasaneyldrm/exercises-dataset（videos/<id>-<hash>.gif）
// 关键发现：GIF 文件名前缀「<id>」与预设动作库 data/exercises.preset.js 的 id 完全 1:1 对应，
//           1324 个动作全部命中（覆盖率 100%）。
//
// 本地存放：把 videos/<id>-<hash>.gif 重命名为 <id>.gif 放到 /assets/exercise-gif/ 下
//           （该目录已在 .gitignore 忽略，二进制不入库，避免版权与体积问题）。
//
// 用法：
//   const { gifForId } = require('../../data/exercise-gif-map.js')
//   const src = gifForId(exercise.id)  // => '/assets/exercise-gif/0001.gif'
//
// 版权：GIF 为 © Gymvisual 素材，须保留署名（详情页已展示「© Gymvisual」）；
//       商用上线应改为自托管 CDN（downloadFile 合法域名白名单只配一个）。

function gifForId(id) {
  if (!id) return ''
  return '/assets/exercise-gif/' + id + '.gif'
}

module.exports = { gifForId }
