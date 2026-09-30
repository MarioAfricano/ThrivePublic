import { formatEuro } from '../../data/initialData.js'
import {
  getAforroTier as getTier,
  aforroNextPaymentDate as nextPaymentDate,
  aforroEstimateNextPayment as estimateNextPayment,
} from '../../utils/calc/savingsCalc.js'
import { monthsElapsed, daysUntil, fmtDate } from './utils.js'

// ── Timeline de próximos pagamentos ──────────────────────────────
// Ordena certificados pela data do próximo pagamento e desenha-os
// como timeline vertical com dots coloridos conforme proximidade
// (≤7d urgente, ≤31d "brevemente"). Valores estimados líquidos
// (já descontado IRS 28% — desconto feito em estimateNextPayment).
export default function PaymentsTimeline({ certificates, euribor }) {
  const upcoming = [...certificates]
    .map(c => ({
      cert: c,
      date: nextPaymentDate(c.date),
      days: daysUntil(nextPaymentDate(c.date)),
      est:  estimateNextPayment(c, euribor),
    }))
    .sort((a, b) => a.date - b.date)

  const totalNextMonth = upcoming
    .filter(u => u.days <= 31)
    .reduce((s, u) => s + u.est, 0)

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Próximos Pagamentos</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 7px', borderRadius: 20, border: '1px solid var(--border)' }}>
            {upcoming.length} certificado{upcoming.length !== 1 ? 's' : ''}
          </span>
        </div>
        {totalNextMonth > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Nos próximos 31 dias:&nbsp;
            <strong style={{ color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>+{formatEuro(totalNextMonth)}</strong>
          </span>
        )}
      </div>

      {/* Timeline entries */}
      <div style={{ padding: '8px 0' }}>
        {upcoming.map((u, i) => {
          const urgent  = u.days <= 7
          const soon    = u.days <= 31
          const dotColor = urgent ? 'var(--green)' : soon ? '#60a5fa' : 'var(--text-muted)'
          const months  = monthsElapsed(u.cert.date)
          const tier    = getTier(months)
          return (
            <div key={u.cert.id} style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
              {/* Linha vertical */}
              {i < upcoming.length - 1 && (
                <div style={{ position: 'absolute', left: 27, top: '50%', bottom: '-50%', width: 1, background: 'var(--border)', zIndex: 0 }} />
              )}
              {/* Dot */}
              <div style={{ width: 54, display: 'flex', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: dotColor, border: `2px solid ${dotColor}`,
                  boxShadow: urgent ? `0 0 8px ${dotColor}60` : 'none',
                }} />
              </div>
              {/* Content */}
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 18px 9px 0', flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtDate(u.date)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: dotColor, fontWeight: 600, marginTop: 1 }}>
                    {u.days === 0 ? 'hoje' : u.days === 1 ? 'amanhã' : `em ${u.days} dias`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    background: `${tier.color}20`, color: tier.color, border: `1px solid ${tier.color}40`, flexShrink: 0,
                  }}>{tier.label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatEuro(u.cert.amount)} investido
                  </span>
                  {u.cert.notes && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {u.cert.notes}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--green)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  +{formatEuro(u.est)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '8px 18px 12px', borderTop: '1px solid var(--border)' }}>
        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Valores estimados com base no Euribor actual e no escalão de bónus de cada certificado · líquidos de IRS (28%)
        </p>
      </div>
    </div>
  )
}
