import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { CreditCard } from 'lucide-react'
import {
  formatEuro, MONTHS_SHORT, compareMK,
} from '../../data/initialData.js'
import {
  getMonthPayments, getDebtPayoff, buildYearlyChart,
} from '../../utils/calc/debtCalc.js'
import ErrorBoundary from '../ErrorBoundary.jsx'
import { DEBT_COLORS } from './constants.js'

// ── Secção de Dívidas (opcional, visível no Dashboard) ─────────
// Aparece quando `debtSettings.showOnDashboard` e existem dívidas.
// 3 KPIs (total em dívida, prestação mensal, pagas este mês) + lista
// com data prevista de liquidação + ComposedChart com trajetória real
// (linhas sólidas) e projetada (tracejado) por dívida.
export default function DebtsDashSection({ data, setPage, mk }) {
  const debts = data?.debts || []
  const activeDebts = debts.filter(d => {
    if (!d.ativa) return false
    if (d.inicioMK && compareMK(d.inicioMK, mk) > 0) return false
    return true
  })
  if (!activeDebts.length) return null

  const totalMonthly = activeDebts.reduce((s, d) => s + d.prestacaoMensal, 0)
  const paidCount = activeDebts.filter(d => getMonthPayments(d, mk).length > 0).length

  // Build combined yearly chart: for each year, sum all debts' balances
  const allData = activeDebts.map(d => buildYearlyChart(d, mk))
  const allYears = [...new Set(allData.flatMap(pts => pts.map(p => p.year)))].sort((a, b) => a - b)

  const chartData = allYears.map(y => {
    const pt = { year: y }
    activeDebts.forEach((d, i) => {
      const match = allData[i].find(p => p.year === y)
      pt[`actual_${i}`] = match?.actual
      pt[`proj_${i}`] = match?.projected
    })
    return pt
  })

  // Payoff labels per debt
  const payoffs = activeDebts.map(d => getDebtPayoff(d, mk))

  const totalBalance = payoffs.reduce((s, p) => s + p.currentBalance, 0)

  const debtTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--text)' }}>{label}</p>
        {activeDebts.map((d, i) => {
          const v = payload.find(p => p.dataKey === `actual_${i}`)?.value ?? payload.find(p => p.dataKey === `proj_${i}`)?.value
          return v != null ? (
            <p key={i} style={{ margin: 0, color: DEBT_COLORS[i % DEBT_COLORS.length] }}>
              {d.nome}: {formatEuro(v, 0)}
            </p>
          ) : null
        })}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={15} color="#ef4444" />
          <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Dívidas</h2>
        </div>
        <button
          onClick={() => setPage('dividas')}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
        >
          Ver detalhe →
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total em dívida', value: formatEuro(totalBalance, 0) },
          { label: 'Prestação mensal', value: formatEuro(totalMonthly) },
          { label: 'Pagas este mês', value: `${paidCount} / ${activeDebts.length}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Payoff dates per debt */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
        {activeDebts.map((d, i) => {
          const { payoffYear, payoffMonth, monthsLeft } = payoffs[i]
          const yearsLeft = monthsLeft != null ? (monthsLeft / 12).toFixed(1) : null
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: DEBT_COLORS[i % DEBT_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text)', flex: 1 }}>{d.nome}</span>
              {payoffYear != null && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  liquidação {MONTHS_SHORT[payoffMonth]} {payoffYear} · {yearsLeft} anos
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Trajectory chart */}
      <div style={{ height: 160 }}>
        <ErrorBoundary name="chart:debt-trajectory" variant="chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={debtTooltip} />
              {activeDebts.map((d, i) => {
                const color = DEBT_COLORS[i % DEBT_COLORS.length]
                return [
                  <Line key={`a${i}`} dataKey={`actual_${i}`} stroke={color} strokeWidth={2} dot={false} connectNulls name={d.nome} />,
                  <Line key={`p${i}`} dataKey={`proj_${i}`} stroke={color} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />,
                ]
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </ErrorBoundary>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Linha sólida = pagamentos reais · tracejado = projeção à taxa atual
      </p>
    </div>
  )
}
