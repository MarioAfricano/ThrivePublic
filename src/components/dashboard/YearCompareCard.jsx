import { useState } from 'react'
import { CalendarRange } from 'lucide-react'
import {
  formatEuro, getMK, MONTHS_SHORT,
  calcAforroTotal, calcPPRTotal,
} from '../../data/initialData.js'
import { lastSnapshotOfYear, compareYearSnaps } from '../../utils/calc/yearCompareCalc.js'

// ── Comparação ano-a-ano (Dashboard) ────────────────────────────
// Último snapshot de cada ano lado a lado, por categoria. Só aparece
// com pelo menos dois anos de snapshots. Aforro/PPR recalculados ao
// mk do snapshot (snapshots antigos podem não os ter gravados).
export default function YearCompareCard({ data }) {
  const years = data?.years || {}
  const available = Object.keys(years).map(Number)
    .filter(y => lastSnapshotOfYear(years, y))
    .sort((a, b) => a - b)

  const [selA, setSelA] = useState(null)
  const [selB, setSelB] = useState(null)

  if (available.length < 2) return null

  const yb = selB ?? available[available.length - 1]
  const ya = selA ?? available.filter(y => y < yb).pop() ?? available[0]

  const enrich = (y) => {
    const last = lastSnapshotOfYear(years, y)
    if (!last) return { snap: null, label: '—' }
    const mk = getMK(y, last.m)
    return {
      snap: {
        ...last.snap,
        aforro: calcAforroTotal(data?.aforro, mk),
        ppr:    calcPPRTotal(data?.ppr?.platforms || [], mk),
      },
      label: `${MONTHS_SHORT[last.m]} ${y}`,
    }
  }
  const A = enrich(ya)
  const B = enrich(yb)
  const cmp = compareYearSnaps(A.snap, B.snap)

  const selStyle = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5,
    color: 'var(--text)', fontSize: '0.68rem', padding: '2px 4px', fontWeight: 600,
  }
  const fmtPct = (pct) => pct == null ? '' : ` (${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(0)}%)`
  const deltaColor = (d) => d >= 0 ? 'var(--green)' : '#ef4444'

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
          <CalendarRange size={13} color="#a78bfa" /> Ano a ano
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <select value={ya} onChange={e => setSelA(Number(e.target.value))} style={selStyle}>
            {available.filter(y => y !== yb).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>→</span>
          <select value={yb} onChange={e => { const v = Number(e.target.value); setSelB(v); if (ya === v) setSelA(null) }} style={selStyle}>
            {available.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 10 }}>
        {A.label} vs {B.label} (últimos fechos disponíveis)
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {cmp.rows.filter(r => r.a !== 0 || r.b !== 0).map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: r.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', width: 62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flex: 1, textAlign: 'right' }}>{formatEuro(r.a)}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', flex: 1, textAlign: 'right' }}>{formatEuro(r.b)}</span>
            <span style={{ color: deltaColor(r.delta), fontVariantNumeric: 'tabular-nums', width: 110, textAlign: 'right', fontWeight: 600 }}>
              {r.delta >= 0 ? '+' : ''}{formatEuro(r.delta)}{fmtPct(r.pct)}
            </span>
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
          <span style={{ width: 6, flexShrink: 0 }} />
          <span style={{ color: 'var(--text)', fontWeight: 700, width: 62 }}>Total</span>
          <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flex: 1, textAlign: 'right' }}>{formatEuro(cmp.totalA)}</span>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 1, textAlign: 'right' }}>{formatEuro(cmp.totalB)}</span>
          <span style={{ color: deltaColor(cmp.delta), fontVariantNumeric: 'tabular-nums', width: 110, textAlign: 'right', fontWeight: 700 }}>
            {cmp.delta >= 0 ? '+' : ''}{formatEuro(cmp.delta)}{fmtPct(cmp.pct)}
          </span>
        </div>
      </div>
    </div>
  )
}
