import { Scale } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { compareEnglobamento, AUTONOMOUS_RATE } from '../../utils/calc/englobamentoCalc.js'
import { EditableField } from '../ui/EditableField.jsx'

// ── Simulador: englobar ou taxa autónoma? ──────────────────────────
// Compara os 28% autónomos com o englobamento das mais-valias de
// ações/ETFs nas taxas gerais, dado o rendimento coletável do ano
// (guardado em data.profile.taxableIncome).
export default function EnglobamentoCard({ gains, year, taxableIncome, onSetTaxableIncome }) {
  const r = compareEnglobamento({ taxableIncome: taxableIncome || 0, gains, year })

  const verdict = {
    englobamento: { text: 'Compensa englobar', color: 'var(--green)' },
    autonoma:     { text: 'Compensa a taxa autónoma (28%)', color: 'var(--accent)' },
    igual:        { text: 'Indiferente', color: 'var(--text-muted)' },
  }[r.better]

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Scale size={14} color="var(--accent)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
            Englobar ou taxa autónoma? · {year}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Rendimento coletável anual:
          <EditableField type="number" value={taxableIncome || 0}
            onSave={v => onSetTaxableIncome(Math.max(0, v))}
            formatter={v => (v > 0 ? formatEuro(v) : 'definir')} width={85} fontSize="0.75rem" fontWeight={600} />
        </div>
      </div>

      {!(gains > 0) ? (
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Sem mais-valias positivas de ações/ETFs em {year}.
          {gains < 0 && ' Nota: menos-valias só são reportáveis (até 5 anos) se optares pelo englobamento.'}
        </p>
      ) : !taxableIncome ? (
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Define o teu rendimento coletável anual (salário bruto menos deduções específicas — vê na última nota de liquidação) para comparar as duas opções.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Taxa autónoma ({(AUTONOMOUS_RATE * 100).toFixed(0)}%)</p>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: r.better === 'autonoma' ? 'var(--green)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                −{formatEuro(r.taxAutonoma)}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Englobamento</p>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: r.better === 'englobamento' ? 'var(--green)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                −{formatEuro(r.taxEnglobamento)}
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                  taxa efetiva {(r.effectiveRate * 100).toFixed(1)}%
                </span>
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Veredito</p>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: verdict.color }}>
                {verdict.text}
                {r.better !== 'igual' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: 6 }}>
                    (poupas {formatEuro(r.saving)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-muted)', opacity: 0.75, lineHeight: 1.5 }}>
            Tabela de {r.tableYear} (continente), sem deduções à coleta nem adicional de solidariedade.
            Ganhos de ativos detidos &lt;365 dias são englobados obrigatoriamente se o rendimento coletável estiver no último escalão.
            Englobar também abrange os restantes rendimentos da categoria — confirma com o teu contabilista.
          </p>
        </>
      )}
    </div>
  )
}
