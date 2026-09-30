import { DollarSign } from 'lucide-react'
import { formatEuro, MONTHS_SHORT } from '../../data/initialData.js'
import { dividendSummary, trailingDividends, dividendsByYear } from '../../utils/calc/dividendCalc.js'

// ── Secção de dividendos (Carteira) ────────────────────────────────
// Calendário mensal do ano selecionado, rendimento passivo dos últimos
// 12 meses, evolução ano-a-ano e as posições pagadoras com yield-on-cost.
export default function DividendsSection({ holdings, year }) {
  const { total, byMonth, positions } = dividendSummary(holdings, year)
  const now = new Date()
  const trailing = trailingDividends(holdings, now.getFullYear(), now.getMonth(), 12)
  const byYear = dividendsByYear(holdings)
  const maxYear = Math.max(...byYear.map(r => r.total), 1)

  if (total <= 0 && trailing <= 0) return null

  const maxMonth = Math.max(...byMonth, 1)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
          <DollarSign size={13} color="#fbbf24" /> Dividendos · {year}
        </h2>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Últimos 12 meses: <strong style={{ color: '#fbbf24' }}>{formatEuro(trailing)}</strong>
          <span style={{ opacity: 0.8 }}> (≈ {formatEuro(trailing / 12)}/mês)</span>
        </div>
      </div>

      {/* Calendário mensal (barras) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, alignItems: 'end', height: 84, marginBottom: 6 }}>
        {byMonth.map((v, i) => (
          <div key={i} title={`${MONTHS_SHORT[i]}: ${formatEuro(v)}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
            {v > 0 && (
              <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(v)}
              </span>
            )}
            <div style={{
              width: '100%', borderRadius: '3px 3px 0 0',
              height: v > 0 ? `${Math.max(8, (v / maxMonth) * 56)}px` : '2px',
              background: v > 0 ? 'rgba(251,191,36,0.65)' : 'var(--wa-06)',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, marginBottom: 14 }}>
        {MONTHS_SHORT.map((m, i) => (
          <span key={i} style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center' }}>{m}</span>
        ))}
      </div>

      {/* Evolução ano-a-ano */}
      {byYear.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
            Evolução anual
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {byYear.map((r, i) => {
              const prev = i > 0 ? byYear[i - 1].total : null
              const growth = prev > 0 ? ((r.total - prev) / prev) * 100 : null
              const isCurrent = r.year === now.getFullYear()
              return (
                <div key={r.year} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem' }}>
                  <span style={{ width: 34, color: 'var(--text-secondary)', fontWeight: r.year === year ? 700 : 400 }}>{r.year}</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--wa-06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${(r.total / maxYear) * 100}%`,
                      background: 'rgba(251,191,36,0.65)' }} />
                  </div>
                  <span style={{ color: '#fbbf24', fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: 76, textAlign: 'right' }}>
                    {formatEuro(r.total)}
                  </span>
                  <span style={{ color: growth == null ? 'var(--text-muted)' : growth >= 0 ? 'var(--green)' : '#ef4444',
                    fontVariantNumeric: 'tabular-nums', width: 62, textAlign: 'right', fontSize: '0.64rem' }}>
                    {growth == null ? '—' : `${growth >= 0 ? '+' : ''}${growth.toFixed(0)}%${isCurrent ? '*' : ''}`}
                  </span>
                </div>
              )
            })}
          </div>
          {byYear.some(r => r.year === now.getFullYear()) && (
            <p style={{ fontSize: '0.58rem', color: 'var(--text-muted)', margin: '4px 0 0', opacity: 0.7 }}>
              * ano em curso — ainda incompleto
            </p>
          )}
        </div>
      )}

      {/* Posições pagadoras + yield on cost */}
      {positions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {positions.slice(0, 8).map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text)', width: 60 }}>{p.ticker}</span>
              <span style={{ color: 'var(--text-muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <span style={{ color: '#fbbf24', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(p.total)}</span>
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', width: 78, textAlign: 'right' }}>
                {p.yoc != null ? `YoC ${(p.yoc * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
          ))}
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '6px 0 0', opacity: 0.7 }}>
            Total {year}: {formatEuro(total)} · YoC = dividendos do ano / custo da posição
          </p>
        </div>
      )}
    </div>
  )
}
