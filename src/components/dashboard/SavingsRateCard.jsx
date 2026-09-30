import { Percent } from 'lucide-react'
import { formatEuro, getMK, MONTHS_SHORT } from '../../data/initialData.js'
import { snapTotal, aggregateSavingsRate, avgMonthlySavings } from '../../utils/calc/incomeCalc.js'
import { EditableField } from '../ui/EditableField.jsx'

// ── Taxa de poupança ───────────────────────────────────────────────
// Rendimento líquido do mês (data.income[mk], editável) vs variação do
// património face ao mês anterior. A variação inclui valorização de
// mercado — é uma aproximação da poupança, avisada em rodapé.
export default function SavingsRateCard({ data, saveData, liveTotal, year, month }) {
  const mk     = getMK(year, month)
  const income = data?.income || {}
  const inc    = income[mk]

  // Mês anterior (snapshot); mês actual usa o total live
  const py = month === 0 ? year - 1 : year
  const pm = month === 0 ? 11 : month - 1
  const prevTotal = snapTotal(data?.years?.[py]?.months?.[pm])
  const delta = prevTotal != null ? liveTotal - prevTotal : null
  const rate  = inc > 0 && delta != null ? delta / inc : null

  const agg = aggregateSavingsRate(data?.years, income, { endY: py, endM: pm, months: 12 })

  // Poupança média por mês este ano (€) — baseline em dez do ano anterior
  // ou no primeiro snapshot do ano
  const yearAvg = avgMonthlySavings(data?.years, liveTotal, year, month)

  const rateColor = r => (r >= 0.2 ? 'var(--green)' : r >= 0 ? '#fbbf24' : '#ef4444')

  function setIncome(v) {
    const next = { ...income }
    if (v > 0) next[mk] = v
    else delete next[mk]
    saveData({ income: next })
  }

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 2px' }}>
        <Percent size={13} color="var(--green)" /> Taxa de poupança
      </h2>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Quanto do que ganhas fica no património
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rendimento do mês</p>
          <EditableField type="number" value={inc ?? 0}
            onSave={setIncome}
            formatter={v => (v > 0 ? formatEuro(v) : 'definir')}
            width={85} fontSize="0.95rem" fontWeight={700} />
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Δ património</p>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: delta == null ? 'var(--text-muted)' : delta >= 0 ? 'var(--text)' : '#ef4444' }}>
            {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${formatEuro(delta)}`}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Este mês</p>
          <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: rate == null ? 'var(--text-muted)' : rateColor(rate) }}>
            {rate == null ? '—' : `${(rate * 100).toFixed(0)}%`}
          </p>
        </div>
        {agg && (
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Últimos {agg.monthsUsed} meses</p>
            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: rateColor(agg.rate) }}>
              {(agg.rate * 100).toFixed(0)}%
            </p>
          </div>
        )}
        {yearAvg && (
          <div title={`Desde ${MONTHS_SHORT[Number(yearAvg.baselineMK.split('-')[1])]} ${yearAvg.baselineMK.split('-')[0]} (${yearAvg.months} ${yearAvg.months === 1 ? 'mês' : 'meses'})`}>
            <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Média/mês {year}</p>
            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: yearAvg.avg >= 0 ? 'var(--green)' : '#ef4444' }}>
              {yearAvg.avg >= 0 ? '+' : ''}{formatEuro(yearAvg.avg)}
            </p>
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '10px 0 0', opacity: 0.7 }}>
        Δ inclui valorização de mercado — aproximação, não contabilidade de fluxos.
        {rate == null && inc > 0 && ' Precisa do snapshot do mês anterior.'}
      </p>
    </div>
  )
}
