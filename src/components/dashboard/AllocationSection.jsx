import { Target } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { allocationRows, seedTargetsFromActual } from '../../utils/calc/allocationCalc.js'
import { EditableField } from '../ui/EditableField.jsx'

// ── Alocação alvo e rebalanceamento ────────────────────────────────
// Compara a distribuição actual com os alvos (%) definidos pelo
// utilizador e mostra quanto mover em € para reequilibrar. Alvos em
// `data.allocation.targets` ({ id: pct }). Desvios < 1 p.p. contam
// como equilibrados.
const BALANCED_PP = 1

export default function AllocationSection({ categories, targets, onSaveTargets }) {
  const hasTargets = targets && Object.keys(targets).length > 0
  const { rows, total, sumTargets } = allocationRows(categories, targets)

  function setTarget(id, pct) {
    const next = { ...(targets || {}), [id]: Math.max(0, Math.min(100, Math.round(pct))) }
    if (next[id] === 0) delete next[id]
    onSaveTargets(next)
  }

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 }}>
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
          <Target size={13} color="var(--accent)" /> Alocação alvo
        </h2>
        {hasTargets && sumTargets !== 100 && (
          <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 600 }}>
            alvos somam {sumTargets}% (≠ 100%)
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        {hasTargets ? 'Desvio face à distribuição desejada' : 'Define a distribuição desejada por categoria'}
      </p>

      {!hasTargets ? (
        <button onClick={() => onSaveTargets(seedTargetsFromActual(categories))}
          style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8, color: 'var(--accent)', padding: '8px 14px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
          Definir alvos a partir da distribuição actual
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(r => {
            const balanced = r.deltaPct != null && Math.abs(r.deltaPct) < BALANCED_PP
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', width: 68, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'right' }}>
                  {r.actualPct.toFixed(1)}%
                </span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <EditableField type="number" value={r.targetPct ?? 0}
                  onSave={v => setTarget(r.id, v)}
                  formatter={v => `${Math.round(v)}%`} width={40} fontSize="0.72rem" fontWeight={600} />
                <span style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  color: balanced ? 'var(--green)' : r.deltaEur > 0 ? '#fbbf24' : '#60a5fa', fontWeight: 600 }}>
                  {r.deltaEur == null ? '—'
                    : balanced ? '✓ equilibrado'
                    : r.deltaEur > 0 ? `reforçar ${formatEuro(r.deltaEur)}`
                    : `reduzir ${formatEuro(-r.deltaEur)}`}
                </span>
              </div>
            )
          })}
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '6px 0 0', opacity: 0.7 }}>
            Sobre {formatEuro(total)} de património · atual / alvo · alvo a 0% remove a categoria
          </p>
        </div>
      )}
    </div>
  )
}
