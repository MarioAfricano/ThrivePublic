// ── Sparkline inline (mini-gráfico de 12 meses) ──────────────────
// Usado no header de cada plataforma PPR. Valores `null` são
// omitidos (mês sem dados). Precisa de ≥2 pontos para desenhar.
export default function Sparkline({ vals, color }) {
  const pts = vals.map((v, i) => [i, v]).filter(([, v]) => v !== null)
  if (pts.length < 2) return null

  const W = 96, H = 32, pad = 2
  const ys = pts.map(([, v]) => v)
  const minV = Math.min(...ys), maxV = Math.max(...ys)
  const range = maxV - minV || 1
  const xAt = i => pad + (i / 11) * (W - pad * 2)
  const yAt = v => H - pad - ((v - minV) / range) * (H - pad * 2 - 2)

  const line  = pts.map(([i, v]) => `${xAt(i)},${yAt(v)}`).join(' ')
  const area  = [
    `${xAt(pts[0][0])},${H}`,
    ...pts.map(([i, v]) => `${xAt(i)},${yAt(v)}`),
    `${xAt(pts.at(-1)[0])},${H}`,
  ].join(' ')
  const [lx, lv] = pts.at(-1)
  const uid = color.replace(/[^a-z0-9]/gi, '')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0}    />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sp-${uid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1}
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xAt(lx)} cy={yAt(lv)} r={2} fill={color} />
    </svg>
  )
}
