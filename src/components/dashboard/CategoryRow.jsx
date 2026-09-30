import { formatEuro } from '../../data/initialData.js'

// ── Linha de categoria (substitui o antigo StatCard) ───────────
// Barra de cor vertical + nome + mini-barra de %, seguida de
// percentagem, valor e delta (sinal + absoluto) em formato tabular.
// Tem 3 estados: normal, hover, activo (filtro aplicado).
export default function CategoryRow({ label, value, percent, color, profit, onClick, active }) {
  const delta = profit ?? 0
  const hasDelta = profit !== undefined
  const up = delta >= 0
  return (
    <button type="button" onClick={onClick}
      aria-pressed={!!active}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 9, width: '100%', textAlign: 'left',
        background: active ? 'rgba(129,140,248,0.08)' : 'transparent',
        border: `1px solid ${active ? 'rgba(129,140,248,0.28)' : 'transparent'}`,
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--wa-03)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {/* colour bar */}
      <div aria-hidden="true" style={{ width: 3, height: 30, borderRadius: 2, background: color, flexShrink: 0 }} />
      {/* name + mini bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        <div style={{ height: 3, background: 'var(--wa-06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(percent, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
      </div>
      {/* % */}
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{percent.toFixed(0)}%</span>
      {/* value */}
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', minWidth: 76, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(value)}</span>
      {/* delta */}
      {hasDelta && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, minWidth: 58, textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: Math.abs(delta) < 0.005 ? 'var(--text-muted)' : up ? 'var(--green)' : 'var(--red)',
        }}>
          {Math.abs(delta) < 0.005 ? '—' : `${up ? '+' : ''}${formatEuro(delta)}`}
        </span>
      )}
    </button>
  )
}
