import { Receipt } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { pprTaxBenefit } from '../../utils/calc/pprTaxCalc.js'
import { EditableField } from '../ui/EditableField.jsx'

// ── Cartão: benefício fiscal do PPR (dedução à coleta) ────────────
// Mostra as entregas do ano civil, a dedução estimada (20% com teto por
// idade) e quanto falta investir para maximizar. Pede o ano de
// nascimento na primeira utilização (guardado em data.profile).
export default function TaxBenefitCard({ platforms, year, birthYear, onSetBirthYear }) {
  const b = pprTaxBenefit(platforms, year, birthYear)

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: b.bracket ? 12 : 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={14} color="var(--accent)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
            Benefício fiscal IRS · {year}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Ano de nascimento:
          <EditableField
            type="number"
            value={birthYear || 0}
            formatter={v => (v ? String(Math.round(v)) : '—')}
            onSave={v => { const y = Math.round(v); if (y >= 1900 && y <= 2100) onSetBirthYear(y) }}
            width={52} fontSize="0.72rem" fontWeight={600}
          />
        </div>
      </div>

      {!b.bracket ? (
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Define o teu ano de nascimento para calcular a dedução à coleta
          (20% das entregas, com teto por idade).
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entregas em {year}</p>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(b.invested)}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dedução estimada</p>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                {formatEuro(b.deduction)}
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                  teto {formatEuro(b.bracket.maxDeduction)}
                </span>
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Para maximizar</p>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: b.maxed ? 'var(--green)' : '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
                {b.maxed ? 'Teto atingido ✓' : `+${formatEuro(b.remainingInvestment)}`}
              </p>
            </div>
          </div>

          {/* Barra de progresso: entregas vs investimento útil */}
          <div style={{ height: 6, background: 'var(--wa-06)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(100, (b.invested / b.bracket.maxInvestment) * 100)}%`,
              background: b.maxed ? 'var(--green)' : 'linear-gradient(90deg, #a78bfa, #818cf8)',
              transition: 'width 0.3s',
            }} />
          </div>

          <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-muted)', opacity: 0.75, lineHeight: 1.5 }}>
            Idade a 1 de janeiro: {b.age} anos ({b.bracket.label}) · 20% das entregas até {formatEuro(b.bracket.maxInvestment)}.
            Sujeito ao teto global de deduções à coleta do teu escalão de rendimento; entregas após a reforma não contam.
          </p>
        </>
      )}
    </div>
  )
}
