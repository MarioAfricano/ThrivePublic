import { useState } from 'react'
import { formatEuro, getMK, MONTHS_SHORT, calcPPRTotal } from '../../data/initialData.js'
import { niceYTicks, fmtYVal } from './utils.js'

// ── Gráfico partilhado de todas as plataformas ───────────────────
// SVG custom (sem recharts). Linha vertical marca o mês actual,
// hover mostra tooltip com saldo por plataforma + total. Meses
// sem dados e futuros ficam a null (não desenham ponto/linha).
// Só renderiza com ≥2 plataformas com dados.
export default function PPRSharedChart({ platforms, mk }) {
  const [hov, setHov] = useState(null)
  const [mkYear, mkMonth] = mk.split('-').map(Number)

  const series = platforms.map(p => ({
    p,
    vals: MONTHS_SHORT.map((_, m) => {
      if (m > mkMonth) return null
      const mkey = getMK(mkYear, m)
      // Meses passados: exigir que pelo menos uma conta tenha monthData
      // explícito com balance (senão o saldo seria herdado).
      if (m < mkMonth) {
        const hasData = p.accounts.some(a => {
          const d = a.monthData?.[mkey]
          return d != null && (d.balance != null || d.contributions != null)
        })
        if (!hasData) return null
      }
      return calcPPRTotal([p], mkey)
    }),
  })).filter(s => s.vals.some(v => v !== null))

  if (series.length < 2) return null   // só faz sentido com 2+ plataformas

  const allV = series.flatMap(s => s.vals.filter(v => v !== null))
  const maxV = Math.max(...allV, 1)
  const yTicks = niceYTicks(maxV, 3)

  const W = 800, H = 76
  const PB = 14, PT = 4, PL = 34, PR = 34
  const ph = H - PT - PB
  const pw = W - PL - PR
  const xAt = m => PL + (m / 11) * pw
  const yAt = v => PT + ph - (v / maxV) * ph

  return (
    <div className="card" style={{ padding: '12px 18px 10px' }}>
      {/* Legenda + título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Evolução {mkYear}
        </span>
        {series.map(({ p }) => (
          <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', color: hov !== null ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
            <span style={{ width: 14, height: 1.5, borderRadius: 1, background: p.color, display: 'inline-block' }} />
            {p.name}
          </span>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
          {/* Linha base */}
          <line x1={PL} x2={W - PR} y1={PT + ph} y2={PT + ph} stroke="var(--wa-07)" strokeWidth={0.6} />

          {/* Y-axis: grid + labels */}
          {yTicks.map(v => {
            const y = yAt(v)
            return (
              <g key={v}>
                <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="var(--wa-04)" strokeWidth={0.6} strokeDasharray="3 4" />
                <text x={PL - 3} y={y + 2} textAnchor="end" fontSize={5} fill="var(--wa-22)">{fmtYVal(v)}</text>
              </g>
            )
          })}

          {/* Linha vertical "hoje" */}
          <line x1={xAt(mkMonth)} x2={xAt(mkMonth)} y1={PT} y2={PT + ph}
            stroke="rgba(129,140,248,0.12)" strokeWidth={0.8} />

          {/* Rótulos de meses */}
          {MONTHS_SHORT.map((m, i) => (
            <text key={i} x={xAt(i)} y={H - 2} textAnchor="middle" fontSize={5.5}
              fill={i === mkMonth ? 'rgba(129,140,248,0.75)' : i > mkMonth ? 'var(--wa-14)' : 'var(--wa-25)'}
              fontWeight={i === mkMonth ? 700 : 400}>
              {m}
            </text>
          ))}

          {/* Linhas por plataforma */}
          {series.map(({ p, vals }) => {
            const pts = vals.map((v, m) => v !== null ? [xAt(m), yAt(v)] : null)
            const segs = []; let cur = []
            pts.forEach(pt => {
              if (pt) cur.push(pt)
              else if (cur.length) { segs.push(cur); cur = [] }
            })
            if (cur.length) segs.push(cur)

            const lastPt = pts.filter(Boolean).at(-1)
            const dim = hov !== null && vals[hov] === null

            return (
              <g key={p.id} opacity={dim ? 0.18 : 1} style={{ transition: 'opacity 0.15s' }}>
                {segs.map((s, si) => {
                  if (s.length < 2) return null
                  return (
                    <polyline key={si} points={s.map(([x,y]) => `${x},${y}`).join(' ')}
                      fill="none" stroke={p.color} strokeWidth={1}
                      strokeLinecap="round" strokeLinejoin="round" />
                  )
                })}
                {lastPt && <circle cx={lastPt[0]} cy={lastPt[1]} r={1.8} fill={p.color} />}
                {hov !== null && vals[hov] !== null && (
                  <circle cx={xAt(hov)} cy={yAt(vals[hov])} r={2.5}
                    fill={p.color} stroke="var(--bg-card)" strokeWidth={0.8} />
                )}
              </g>
            )
          })}

          {/* Linha vertical de hover */}
          {hov !== null && (
            <line x1={xAt(hov)} x2={xAt(hov)} y1={PT} y2={PT + ph}
              stroke="var(--wa-08)" strokeWidth={1} />
          )}

          {/* Zonas de hover — cobrindo todo o ano */}
          {MONTHS_SHORT.map((_, m) => (
            <rect key={m} x={xAt(m) - pw / 22} y={0} width={pw / 11} height={H - PB}
              fill="transparent"
              onMouseEnter={() => setHov(m)} onMouseLeave={() => setHov(null)} />
          ))}
        </svg>

        {/* Tooltip */}
        {hov !== null && series.some(s => s.vals[hov] !== null) && (
          <div style={{
            position: 'absolute', bottom: PB + 6,
            left: hov <= 1 ? 0 : hov >= 10 ? 'auto' : `${(hov / 11) * 100}%`,
            right: hov >= 10 ? 0 : 'auto',
            transform: hov > 1 && hov < 10 ? 'translateX(-50%)' : 'none',
            background: 'var(--bg-elevated)', border: '1px solid var(--wa-08)',
            borderRadius: 8, padding: '7px 10px', zIndex: 10,
            pointerEvents: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            minWidth: 120,
          }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {MONTHS_SHORT[hov]} {mkYear}
            </p>
            {series.map(({ p, vals }) => vals[hov] !== null && (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{formatEuro(vals[hov])}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--wa-07)', marginTop: 3, paddingTop: 3, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Total</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f472b6', fontVariantNumeric: 'tabular-nums' }}>
                {formatEuro(series.reduce((s, { vals: v }) => s + (v[hov] ?? 0), 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
