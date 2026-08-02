// 组间休息计时器 · 纯函数（不依赖 wx，便于单测）
// 设计要点：全程基于「结束时间戳 endAt」推算剩余，而非累加计数器——切后台/杀进程回前台不漂移
const DEFAULT_REST = 90 // 未填休息秒时的默认值
const MAX_REST = 600    // 上限 10 分钟

// 剩余秒数（向上取整，最少 0）
function remainSec(endAt, now) {
  return Math.max(0, Math.ceil((endAt - now) / 1000))
}

// 已流逝百分比 0-100（圆环进度 = 100 - 该值，实现「剩余量排水」效果）
function elapsedPct(endAt, now, totalSec) {
  if (!totalSec || totalSec <= 0) return 0
  const remain = remainSec(endAt, now)
  return Math.min(100, Math.max(0, Math.round(((totalSec - remain) / totalSec) * 100)))
}

// 秒 → 「90」「1:30」展示格式
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${r < 10 ? '0' + r : r}` : String(s)
}

module.exports = { DEFAULT_REST, MAX_REST, remainSec, elapsedPct, fmtTime }
