import { formatEuro } from '../../data/initialData.js'

// ── Tooltip do gráfico de Evolução Mensal ──────────────────────
// Com uma série (Total ou categoria isolada) mostra só o valor.
// Com várias (modo "Todas") lista cada categoria com a sua cor,
// ordenada por valor decrescente e com o total da soma no fim —
// com 7 linhas, a ordem alfabética não ajudava a ler nada.
export default function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  if (payload.length === 1) {
    return (
      <div className="custom-tooltip">
        <p className="label">{label}</p>
        <p className="value">{formatEuro(payload[0].value)}</p>
      </div>
    )
  }

  const rows  = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0))
  const total = rows.reduce((s, r) => s + (r.value || 0), 0)

  return (
    <div className="custom-tooltip">
      <p className="label">{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {rows.map(r => (
          <div key={r.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem' }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 2, background: r.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', marginRight: 'auto' }}>{r.name}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatEuro(r.value)}
            </span>
          </div>
        ))}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem',
          marginTop: 3, paddingTop: 3, borderTop: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 'auto' }}>Total</span>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {formatEuro(total)}
          </span>
        </div>
      </div>
    </div>
  )
}
