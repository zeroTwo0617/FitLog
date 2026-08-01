// 极简折线图绘制（小程序 canvas 2d API）
// 设计目标：无坐标轴的干净折线 + 渐变面积 + 端点数值标签 + 稀疏横轴日期
// 仅负责绘制，数据准备见 statsData.js（volumeTrend / oneRMTrend）
//
// points: [{label, value}]；value 为 null 时折线断开（休息日不产生误导性连线）

function drawLineChart(canvas, opts) {
  const ctx = canvas.getContext('2d')
  const dpr = opts.dpr || 2
  const W = opts.width
  const H = opts.height
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)

  const pts = opts.points || []
  if (!pts.length) return

  const padL = 10, padR = 14, padT = 28, padB = 24
  const iw = W - padL - padR
  const ih = H - padT - padB
  const dimColor = opts.dimColor || '#7e8a81'

  const nums = pts.filter((p) => p.value != null).map((p) => Number(p.value))
  if (!nums.length) {
    ctx.fillStyle = dimColor
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(opts.emptyText || '暂无数据', W / 2, H / 2)
    return
  }

  let max = Math.max.apply(null, nums)
  let min = Math.min.apply(null, nums)
  if (max === min) { max = max + 1; min = Math.max(0, min - 1) }
  // 纵轴下限不为 0 时给 8% 呼吸位，避免贴底
  const span = max - min
  min = Math.max(0, min - span * 0.08)
  max = max + span * 0.05
  const range = max - min || 1

  const x = (i) => padL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw)
  const y = (v) => padT + ih - ((v - min) / range) * ih

  const color = opts.color || '#c6f24e'

  // 按 null 断点切分成若干线段
  const segs = []
  let cur = []
  pts.forEach((p, i) => {
    if (p.value == null) {
      if (cur.length) segs.push(cur)
      cur = []
    } else {
      cur.push([x(i), y(Number(p.value))])
    }
  })
  if (cur.length) segs.push(cur)

  segs.forEach((seg) => {
    if (seg.length === 1) {
      // 孤立点：只画圆点
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(seg[0][0], seg[0][1], 3, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    // 折线
    ctx.beginPath()
    seg.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]) })
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    // 渐变面积
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB)
    grad.addColorStop(0, opts.areaTop || 'rgba(198,242,78,0.26)')
    grad.addColorStop(1, opts.areaBottom || 'rgba(198,242,78,0)')
    ctx.lineTo(seg[seg.length - 1][0], H - padB)
    ctx.lineTo(seg[0][0], H - padB)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
  })

  // 末端数值点 + 标签
  let lastIdx = -1
  pts.forEach((p, i) => { if (p.value != null) lastIdx = i })
  if (lastIdx >= 0) {
    const lx = x(lastIdx)
    const ly = y(Number(pts[lastIdx].value))
    ctx.beginPath()
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = opts.dotRing || '#151915'
    ctx.stroke()
    ctx.fillStyle = color
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = lx > W - 56 ? 'right' : 'center'
    ctx.fillText(String(pts[lastIdx].value) + (opts.unit ? ' ' + opts.unit : ''), lx, ly - 9)
  }

  // 横轴稀疏日期标签
  ctx.fillStyle = dimColor
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'center'
  const step = Math.max(1, Math.ceil(pts.length / 6))
  pts.forEach((p, i) => {
    if (i % step !== 0 && i !== pts.length - 1) return
    ctx.fillText(String(p.label), x(i), H - 7)
  })
}

module.exports = { drawLineChart }
