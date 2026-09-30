import { useState } from 'react'
import {
  formatEuro, MONTHS_SHORT, getMK,
  calcAforroTotal, calcPPRTotal,
} from '../../data/initialData.js'
import { getCategoryDefs, CATEGORY_STACK_IDS } from '../../data/categories.js'

// ── Composição Mensal (stacked bars) ───────────────────────────
// 12 colunas empilhadas por categoria, a partir de `data.years[year]
// .months`. Aforro e PPR são re-calculados ao vivo porque não estão
// nos snapshots gravados. Tooltip em hover com breakdown absoluto e %.
// Usa `bare` para quando é embebido dentro de outro card (remove o
// wrapper `.card`).
export default function CompositionChart({ data, year, currentMonth, bare = false }) {
  const [hovered, setHovered] = useState(null)
  const yearSnaps = data?.years?.[year]?.months || {}
  // Cores personalizadas do utilizador, na ordem de pilhagem.
  const CAT_DEFS = getCategoryDefs(data, CATEGORY_STACK_IDS)

  function enrichedSnap(snap, monthIdx) {
    if (!snap) return null
    const snapMK = getMK(year, monthIdx)
    return {
      ...snap,
      aforro: calcAforroTotal(data?.aforro, snapMK),
      ppr:    calcPPRTotal(data?.ppr?.platforms || [], snapMK),
    }
  }

  const inner = (
    <div style={{ padding: bare ? '0' : '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 1 }}>Composição Mensal</h2>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Por categoria · {year}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {CAT_DEFS.map(({ key, label, color }) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />{label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', userSelect: 'none' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {MONTHS_SHORT.map((m, i) => {
            const snap  = enrichedSnap(yearSnaps[i], i)
            const total = snap ? CAT_DEFS.reduce((s, { key }) => s + (snap[key] || 0), 0) : 0
            const hasDat = !!(snap && total > 0)
            const isCur  = i === currentMonth
            const isFut  = i > currentMonth
            const isHov  = hovered === i

            return (
              <div key={i}
                // Focável para o detalhe do mês ficar acessível sem rato:
                // o hover e o foco abrem o mesmo tooltip.
                tabIndex={hasDat ? 0 : -1}
                role={hasDat ? 'button' : undefined}
                aria-label={hasDat ? `${MONTHS_SHORT[i]}: ${formatEuro(total)}` : undefined}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                onMouseEnter={() => hasDat && setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => hasDat && setHovered(i)}
                onBlur={() => setHovered(null)}>
                <div style={{ width: '100%', height: hasDat ? 90 : 16, position: 'relative', transition: 'height 0.2s' }}>
                  {hasDat ? (
                    <div style={{
                      width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden',
                      display: 'flex', flexDirection: 'column-reverse',
                      filter: isHov ? 'brightness(1.15)' : 'brightness(1)',
                      transition: 'filter 0.15s',
                      outline: isCur ? '2px solid rgba(129,140,248,0.5)' : 'none',
                      outlineOffset: 2,
                    }}>
                      {CAT_DEFS.map(({ key, color }) => {
                        const pct = ((snap[key] || 0) / total) * 100
                        if (pct < 0.5) return null
                        return <div key={key} style={{ width: '100%', height: `${pct}%`, background: color }} />
                      })}
                    </div>
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', borderRadius: 3,
                      background: isFut ? 'var(--wa-012)' : 'var(--wa-035)',
                      border: `1px dashed ${isFut ? 'var(--wa-04)' : 'var(--wa-08)'}`,
                    }} />
                  )}
                </div>
                <span style={{
                  fontSize: '0.58rem', fontWeight: isCur ? 700 : 400,
                  color: isCur && !isFut ? 'var(--accent)' : isFut ? 'var(--wa-15)' : 'var(--text-muted)',
                }}>{m}</span>
              </div>
            )
          })}
        </div>

        {hovered !== null && (() => {
          const snap  = yearSnaps[hovered]
          const total = snap ? CAT_DEFS.reduce((s, { key }) => s + (snap[key] || 0), 0) : 0
          if (!snap || !total) return null
          const leftPct   = ((hovered + 0.5) / 12) * 100
          const edgeOffset = hovered <= 1 ? '0%' : hovered >= 10 ? '-100%' : '-50%'
          return (
            <div style={{
              position: 'absolute', bottom: 'calc(100% - 102px)',
              left: `${leftPct}%`, transform: `translateX(${edgeOffset})`,
              background: 'var(--bg-elevated)', border: '1px solid var(--wa-10)',
              borderRadius: 12, padding: '12px 14px', minWidth: 180, zIndex: 20,
              pointerEvents: 'none', boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {MONTHS_SHORT[hovered]} {year}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {CAT_DEFS.map(({ key, label, color }) => {
                  const val = snap[key] || 0
                  if (!val) return null
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 1, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{((val/total)*100).toFixed(0)}%</span>
                      <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(val)}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid var(--wa-07)', marginTop: 7, paddingTop: 7, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>Total</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(total)}</span>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
  return bare ? inner : <div className="card">{inner}</div>
}
