// 仅绘制 1RM 折线图。训练量图使用固定 14 格的 WXSS 柱状图。
// points: [{label, value}]；value 为 null 时只保留日期槽位，不绘制数据点。

function drawLineChart(canvas, opts) {
  const ctx = canvas.getContext('2d')
  const dpr = opts.dpr || 2
  const W = opts.width
  const H = opts.height
  const padL = 42
  const padR = 14
  const padT = 30
  const padB = 30
  const plotW = Math.max(1, W - padL - padR)
  const plotH = Math.max(1, H - padT - padB)
  const pts = opts.points || []
  const color = opts.color || '#c6f24e'
  const dimColor = opts.dimColor || '#7e8a81'
  const gridColor = opts.gridColor || 'rgba(126,138,129,0.18)'

  canvas.width = Math.max(1, Math.round(W * dpr))
  canvas.height = Math.max(1, Math.round(H * dpr))
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)
  if (!pts.length) return

  const valid = []
  pts.forEach((point, index) => {
    const value = Number(point.value)
    if (point.value != null && isFinite(value)) valid.push({ index, value })
  })

  const x = (index) => padL + (pts.length === 1 ? plotW / 2 : (index / (pts.length - 1)) * plotW)
  const drawLabels = () => {
    ctx.fillStyle = dimColor
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    const indexes = []
    const count = Math.min(6, pts.length)
    for (let i = 0; i < count; i++) indexes.push(Math.round(i * (pts.length - 1) / Math.max(1, count - 1)))
    indexes.forEach((index) => ctx.fillText(String(pts[index].label), x(index), H - 7))
  }

  const formatTick = (value) => {
    const rounded = Math.round(value * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
  }

  if (!valid.length) {
    ctx.fillStyle = dimColor
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(opts.emptyText || '暂无数据', W / 2, padT + plotH / 2)
    drawLabels()
    return
  }

  let min = Math.min.apply(null, valid.map((point) => point.value))
  let max = Math.max.apply(null, valid.map((point) => point.value))
  const span = max - min
  const padding = span > 0 ? span : Math.max(1, max * 0.08)
  min = Math.max(0, min - padding * 0.12)
  max += padding * 0.12
  const range = max - min || 1
  const y = (value) => padT + plotH - ((value - min) / range) * plotH

  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  for (let i = 0; i <= 3; i++) {
    const gy = padT + (plotH / 3) * i
    ctx.beginPath()
    ctx.moveTo(padL, gy)
    ctx.lineTo(W - padR, gy)
    ctx.stroke()
  }

  ctx.fillStyle = dimColor
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'right'
  for (let i = 0; i <= 3; i++) {
    const value = max - ((max - min) / 3) * i
    const gy = padT + (plotH / 3) * i
    ctx.fillText(formatTick(value), padL - 7, gy + 3)
  }

  const plotted = valid.map((point) => [x(point.index), y(point.value)])
  if (plotted.length > 1) {
    const area = ctx.createLinearGradient(0, padT, 0, H - padB)
    area.addColorStop(0, opts.areaTop || 'rgba(198,242,78,0.22)')
    area.addColorStop(1, opts.areaBottom || 'rgba(198,242,78,0)')
    ctx.beginPath()
    plotted.forEach((point, index) => { if (index === 0) ctx.moveTo(point[0], point[1]); else ctx.lineTo(point[0], point[1]) })
    ctx.lineTo(plotted[plotted.length - 1][0], H - padB)
    ctx.lineTo(plotted[0][0], H - padB)
    ctx.closePath()
    ctx.fillStyle = area
    ctx.fill()

    ctx.beginPath()
    plotted.forEach((point, index) => { if (index === 0) ctx.moveTo(point[0], point[1]); else ctx.lineTo(point[0], point[1]) })
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  plotted.forEach((point, index) => {
    ctx.beginPath()
    ctx.arc(point[0], point[1], index === plotted.length - 1 ? 4 : 3, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  })

  const last = valid[valid.length - 1]
  const lx = x(last.index)
  const ly = y(last.value)
  ctx.fillStyle = color
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = lx > W - 56 ? 'right' : 'center'
  ctx.fillText(String(last.value) + (opts.unit ? ' ' + opts.unit : ''), lx, ly - 9)
  drawLabels()
}

module.exports = { drawLineChart }
