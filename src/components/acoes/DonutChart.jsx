import { formatEuro } from '../../data/initialData.js'

// ── Donut Chart SVG ─────────────────────────────────────────────
// Gráfico de donut puro SVG com label central "Total". Uma única
// fatia (>99%) degenera no arc path, por isso desenhamos um círculo
// completo nesse caso.
export default function DonutChart({ slices, size = 140 }) {
  const realTotal = slices.reduce((s, sl) => s + sl.value, 0)
  const total = realTotal || 1  // só para evitar divisão por zero nos arcos
  const R = size / 2, r = R * 0.62, cx = R, cy = R
   
  let angle = -90
  const arcs = slices.filter(s => s.value > 0).map(sl => {
    const pct = sl.value / total
    const startAngle = angle
    angle += pct * 360 // eslint-disable-line react-hooks/immutability
    const endAngle = angle
    const large = pct > 0.5 ? 1 : 0
    const toRad = a => (a * Math.PI) / 180
    const x1o = cx + R * Math.cos(toRad(startAngle)), y1o = cy + R * Math.sin(toRad(startAngle))
    const x2o = cx + R * Math.cos(toRad(endAngle)),   y2o = cy + R * Math.sin(toRad(endAngle))
    const x1i = cx + r * Math.cos(toRad(endAngle)),   y1i = cy + r * Math.sin(toRad(endAngle))
    const x2i = cx + r * Math.cos(toRad(startAngle)), y2i = cy + r * Math.sin(toRad(startAngle))
    const d = `M${x1o},${y1o} A${R},${R} 0 ${large} 1 ${x2o},${y2o} L${x1i},${y1i} A${r},${r} 0 ${large} 0 ${x2i},${y2i} Z`
    return { ...sl, d, pct }
  })
  // Quando só há uma fatia, o SVG arc path degenera (360° = ponto inicial = ponto final).
  // Nesse caso usamos um círculo completo em vez de um path.
  const centerLabel = (
    <>
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={11} fill="var(--text-muted)" fontWeight={600}>Total</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={13} fill="var(--text)" fontWeight={800}>{formatEuro(realTotal, 0)}</text>
    </>
  )
  if (arcs.length === 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={arcs[0].color} strokeWidth={R - r} opacity={0.85} />
        {centerLabel}
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Base ring */}
      <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="var(--wa-04)" strokeWidth={R - r} />
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={a.color} opacity={0.85} style={{ transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}>
          <title>{a.label}: {(a.pct * 100).toFixed(1)}%</title>
        </path>
      ))}
      {centerLabel}
    </svg>
  )
}
