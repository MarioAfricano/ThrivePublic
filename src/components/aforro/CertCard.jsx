import { useState } from 'react'
import { Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { EditableField } from '../ui/EditableField.jsx'
import {
  AFORRO_TIERS as TIERS,
  getAforroTier as getTier,
  aforroNextPaymentDate as nextPaymentDate,
  aforroEstimateNextPayment as estimateNextPayment,
  capAforroBaseRate,
  AFORRO_EURIBOR_CAP,
} from '../../utils/calc/savingsCalc.js'
import EditRate from './EditRate.jsx'
import { monthsElapsed, daysUntil, fmtDate, calcValue } from './utils.js'

// ── Cartão de certificado ────────────────────────────────────────
// Mostra escalão actual, investido / valor actual / juros, taxa
// efectiva (Euribor + bónus de escalão), barra de progresso no
// escalão, bloco "próximo pagamento" e histórico de taxas por
// período de 3 meses (expansível). Histórico permite editar ou
// limpar overrides (taxas guardadas por período).
export default function CertCard({ cert, euribor, onUpdate, onRemove }) {
  const [showHistory, setShowHistory] = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)

  const months  = monthsElapsed(cert.date)
  const tier    = getTier(months)
  const nextTier = TIERS.find(t => t.min > months)
  const monthsToNext = nextTier ? nextTier.min - months : null
  const tierProgress = tier.max === Infinity ? 100
    : ((months - tier.min) / (tier.max - tier.min)) * 100

  const cappedBase    = capAforroBaseRate(euribor)
  const isCapped      = (euribor || 0) > AFORRO_EURIBOR_CAP
  const effectiveRate = cappedBase + tier.bonus
  const currentValue  = calcValue(cert, euribor)
  const profit        = currentValue - cert.amount
  const profitPct     = cert.amount > 0 ? profit / cert.amount : 0
  const isPositive    = profit >= 0

  // Quantos períodos de 3 meses já decorreram (ou estão em curso)
  const numPeriods = Math.max(1, Math.ceil((months + 1) / 3))

  function updateRate(ps, rate) {
    onUpdate({ ...cert, rateHistory: { ...(cert.rateHistory || {}), [ps]: rate } })
  }
  function clearRate(ps) {
    const h = { ...(cert.rateHistory || {}) }
    delete h[ps]
    onUpdate({ ...cert, rateHistory: h })
  }

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        {/* ── Coluna principal ── */}
        <div style={{ flex: 1, minWidth: 260 }}>

          {/* Cabeçalho: escalão + data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              background: `${tier.color}20`, color: tier.color, border: `1px solid ${tier.color}40`,
            }}>{tier.label}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {fmtDate(cert.date)} · <strong style={{ color: 'var(--text)' }}>{months}</strong> {months === 1 ? 'mês' : 'meses'}
            </span>
          </div>

          {/* Valores principais */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Investido</p>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {formatEuro(cert.amount)}
              </span>
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                Valor actual
                {cert.valueOverride != null && (
                  <span title="Valor manual" style={{ marginLeft: 5, color: '#fbbf24' }}>✎</span>
                )}
              </p>
              <EditableField type="currency" value={cert.valueOverride ?? currentValue} onSave={v => onUpdate({ ...cert, valueOverride: v })} fontSize="1.15rem" width={110} />
              {cert.valueOverride != null && (
                <button onClick={() => onUpdate({ ...cert, valueOverride: null })}
                  style={{ display: 'block', marginTop: 2, fontSize: '0.62rem', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}>
                  ↺ usar cálculo auto
                </button>
              )}
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Juros</p>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: isPositive ? 'var(--green)' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                {isPositive ? '+' : ''}{formatEuro(profit)}
              </span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: isPositive ? 'var(--green)' : '#ef4444', opacity: 0.75 }}>
                {isPositive ? '+' : ''}{(profitPct * 100).toFixed(3)}%
              </span>
            </div>
          </div>

          {/* Taxa efectiva */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Taxa efectiva:&nbsp;
              <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {(effectiveRate * 100).toFixed(3)}%
              </strong>
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              = Euribor&nbsp;{(cappedBase * 100).toFixed(3)}% + bónus&nbsp;{(tier.bonus * 100).toFixed(2)}%
            </span>
            {isCapped && (
              <span
                title={`Euribor 3M está em ${(euribor * 100).toFixed(3)}%, mas a Série F limita a componente Euribor a ${(AFORRO_EURIBOR_CAP * 100).toFixed(2)}%. O bónus de permanência acumula por cima.`}
                style={{ fontSize: '0.6rem', color: 'var(--yellow)', background: 'rgba(251,191,36,0.1)', padding: '1px 6px', borderRadius: 3 }}>
                limitado a {(AFORRO_EURIBOR_CAP * 100).toFixed(2)}%
              </span>
            )}
          </div>

          {/* Barra de progresso no escalão */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {tier.max === Infinity ? '🏆 Bónus máximo atingido' : `${tier.label} — +${(tier.bonus * 100).toFixed(2)}%`}
              </span>
              {nextTier && (
                <span style={{ fontSize: '0.65rem', color: tier.color }}>
                  {nextTier.label} (+{(nextTier.bonus * 100).toFixed(2)}%) daqui a&nbsp;
                  <strong>{monthsToNext}m</strong>
                </span>
              )}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(100, tierProgress)}%`, background: tier.color }} />
            </div>
          </div>

          {/* ── Próximo pagamento ── */}
          {(() => {
            const nextDate = nextPaymentDate(cert.date)
            const days     = daysUntil(nextDate)
            const est      = estimateNextPayment(cert, euribor)
            const urgent   = days <= 14
            return (
              <div style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '7px 12px', borderRadius: 8,
                background: urgent ? 'rgba(74,222,128,0.07)' : 'rgba(96,165,250,0.06)',
                border: `1px solid ${urgent ? 'rgba(74,222,128,0.2)' : 'rgba(96,165,250,0.12)'}`,
              }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: urgent ? 'var(--green)' : '#60a5fa', flexShrink: 0 }}>
                  {urgent ? '💰' : '📅'} Próximo pagamento
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDate(nextDate)}
                </span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                  background: urgent ? 'rgba(74,222,128,0.12)' : 'var(--wa-06)',
                  color: urgent ? 'var(--green)' : 'var(--text-muted)',
                }}>
                  {days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  +{formatEuro(est)} est.
                </span>
              </div>
            )
          })()}

          {/* Notas */}
          {cert.notes && (
            <p style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {cert.notes}
            </p>
          )}
        </div>

        {/* ── Acções ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowHistory(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: showHistory ? 'var(--accent-dim)' : 'transparent',
              border: `1px solid ${showHistory ? 'rgba(129,140,248,0.3)' : 'var(--border)'}`,
              borderRadius: 5, padding: '4px 10px', fontSize: '0.7rem',
              color: showHistory ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600,
            }}>
            Taxas {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {confirmDel ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onRemove(cert.id)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>
                Apagar
              </button>
              <button onClick={() => setConfirmDel(false)}
                style={{ background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 3 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Histórico de taxas (expansível) ── */}
      {showHistory && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Taxa por período de 3 meses
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Array.from({ length: numPeriods }, (_, i) => i * 3).map(ps => {
              const pe = ps + 3
              const isActive    = months >= ps && months < pe
              const isCompleted = months >= pe
              const storedRate  = cert.rateHistory?.[ps]
              const rawRate     = storedRate != null ? storedRate : (euribor || 0)
              const displayRate = capAforroBaseRate(rawRate)
              const isEstimated = storedRate == null
              const rowCapped   = rawRate > AFORRO_EURIBOR_CAP

              return (
                <div key={ps} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '5px 10px', borderRadius: 6,
                  background: isActive ? 'rgba(129,140,248,0.07)' : 'var(--wa-02)',
                  border: isActive ? '1px solid rgba(129,140,248,0.2)' : '1px solid transparent',
                }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: 72 }}>
                    Mês {ps + 1}–{pe}
                  </span>
                  <span style={{ fontSize: '0.68rem', minWidth: 16, textAlign: 'center',
                    color: isActive ? 'var(--accent)' : isCompleted ? 'var(--green)' : 'var(--text-muted)' }}>
                    {isActive ? '●' : isCompleted ? '✓' : '○'}
                  </span>
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                    color: isEstimated ? '#fbbf24' : 'var(--text)',
                  }}>
                    {(displayRate * 100).toFixed(3)}%
                  </span>
                  {isEstimated && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--yellow)', background: 'rgba(251,191,36,0.1)', padding: '1px 5px', borderRadius: 3 }}>
                      estimado
                    </span>
                  )}
                  {rowCapped && (
                    <span
                      title={`Taxa de ${(rawRate * 100).toFixed(3)}% limitada ao tecto de ${(AFORRO_EURIBOR_CAP * 100).toFixed(2)}% da Série F.`}
                      style={{ fontSize: '0.6rem', color: 'var(--yellow)', background: 'rgba(251,191,36,0.1)', padding: '1px 5px', borderRadius: 3 }}>
                      tecto
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto' }}>
                    <EditRate
                      rate={displayRate}
                      onSave={r => updateRate(ps, r)}
                      onClear={storedRate != null ? () => clearRate(ps) : null}
                    />
                  </span>
                </div>
              )
            })}
          </div>
          <p style={{ marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            Taxas <span style={{ color: 'var(--yellow)' }}>a amarelo</span> são estimadas com o Euribor actual.
            A componente Euribor da Série F está limitada a {(AFORRO_EURIBOR_CAP * 100).toFixed(2)}%; o bónus de permanência acumula por cima.
            Clica no <Pencil size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> para corrigir manualmente.
          </p>
        </div>
      )}
    </div>
  )
}
