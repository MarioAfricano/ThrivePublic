import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { Target, Shield, TrendingUp as RocketIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  formatEuro, MONTHS, MONTHS_SHORT, getMK, DEFAULT_GOAL,
  calcBancoTotal, calcSavingsTotal, calcPPRTotal,
  calcHoldingsTotal, calcBolsosTotal, calcAforroTotal, calcCryptoTotal,
} from '../../data/initialData.js'
import ErrorBoundary from '../ErrorBoundary.jsx'
import SavingsTooltip from './SavingsTooltip.jsx'
import EditGoal from './EditGoal.jsx'

// ── Poupança (secção compacta) ────────────────────────────────
// Cabeçalho + 2 cartões (Certo / Arriscado) com totais ao vivo +
// breakdown por categoria. Progresso contra o objetivo anual
// (editável inline). Mini BarChart empilhado com variação mensal
// desde o primeiro mês com dados do ano.
export default function SavingsSection({ data, saveData }) {
  const year  = data?.currentYear  ?? new Date().getFullYear()
  const month = data?.currentMonth ?? new Date().getMonth()
  const { exchangeRates } = useApp()

  const yearData = data?.years?.[year] || { goal: DEFAULT_GOAL, months: {} }
  const goal     = yearData.goal ?? DEFAULT_GOAL

  const liveMK   = getMK(year, month)
  const livePlat = data?.banks?.platforms || []
  const live = {
    banco:    calcBancoTotal(livePlat, liveMK, exchangeRates),
    poupanca: calcSavingsTotal(livePlat, liveMK, exchangeRates),
    acoes:    calcHoldingsTotal(data?.stocks?.acoes?.holdings, liveMK, exchangeRates),
    etfs:     calcHoldingsTotal(data?.stocks?.etfs?.holdings, liveMK, exchangeRates) + calcBolsosTotal(data?.stocks?.bolsos, liveMK),
    crypto:   calcCryptoTotal(data?.crypto, liveMK),
    ppr:      calcPPRTotal(data?.ppr?.platforms || [], liveMK),
    aforro:   calcAforroTotal(data?.aforro, liveMK),
  }

  function getSnap(m) {
    const stored = yearData.months?.[m]
    const base   = stored ?? (m === month ? live : null)
    if (!base) return null
    const snapMK = getMK(year, m)
    return { ...base, aforro: calcAforroTotal(data?.aforro, snapMK), ppr: calcPPRTotal(data?.ppr?.platforms || [], snapMK) }
  }

  let baseMonth = -1, baseSnap = null
  for (let i = 0; i < 12; i++) {
    const s = getSnap(i)
    if (s) { baseMonth = i; baseSnap = s; break }
  }
  const base         = baseSnap || live
  const baseMonthName = baseMonth >= 0 ? MONTHS_SHORT[baseMonth] : MONTHS_SHORT[0]
  const current      = getSnap(month)

  const baseCerto  = base.banco + base.poupanca + base.aforro + base.ppr
  const baseArris  = (base.acoes || 0) + (base.etfs || 0) + (base.crypto || 0)
  const curCerto   = current ? current.banco + current.poupanca + current.aforro + current.ppr : baseCerto
  const curArris   = current ? (current.acoes || 0) + (current.etfs || 0) + (current.crypto || 0) : baseArris
  const certoDiff  = curCerto - baseCerto
  const arrisDiff  = curArris - baseArris
  const totalSaved = certoDiff + arrisDiff
  const progress   = goal > 0 ? (totalSaved / goal) * 100 : 0
  const goalMet    = totalSaved >= goal

  const chartData = MONTHS_SHORT.map((m, i) => {
    if (baseMonth >= 0 && i < baseMonth) return null
    const snap = getSnap(i)
    if (!snap) return { month: m, certo: null, arrisado: null }
    return {
      month: m,
      certo:    (snap.banco + snap.poupanca + snap.aforro + snap.ppr) - baseCerto,
      arrisado: ((snap.acoes || 0) + (snap.etfs || 0) + (snap.crypto || 0)) - baseArris,
    }
  }).filter(Boolean)

  function saveGoal(v) {
    const prevYears = data?.years || {}
    const prevYear  = prevYears[year] || { goal: DEFAULT_GOAL, months: {} }
    saveData({ years: { ...prevYears, [year]: { ...prevYear, goal: v } } })
  }

  return (
    <div className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 1 }}>Poupança {year}</h2>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Variação desde {baseMonthName} → {MONTHS[month]}</p>
        </div>
        <span className={`badge ${goalMet ? 'badge-green' : progress < 0 ? 'badge-red' : 'badge-accent'}`}
          style={{ fontSize: '0.7rem' }}>
          {progress.toFixed(0)}% da meta
        </span>
      </div>

      {/* Dois totais lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          {
            label: 'Poupado Certo', total: curCerto, diff: certoDiff,
            color: '#818cf8', dimColor: 'rgba(129,140,248,0.08)', icon: <Shield size={12} color="#818cf8" />,
            items: [
              { label: 'Poupança', value: current?.poupanca || 0, color: '#818cf8' },
              { label: 'Aforro',   value: current?.aforro   || 0, color: '#60a5fa' },
              { label: 'PPR',      value: current?.ppr      || 0, color: '#f472b6' },
              { label: 'Banco',    value: current?.banco    || 0, color: '#fbbf24' },
            ],
          },
          {
            label: 'Arriscado', total: curArris, diff: arrisDiff,
            color: '#4ade80', dimColor: 'rgba(74,222,128,0.06)', icon: <RocketIcon size={12} color="#4ade80" />,
            items: [
              { label: 'ETFs',   value: current?.etfs   || 0, color: '#22d3ee' },
              { label: 'Ações',  value: current?.acoes  || 0, color: '#4ade80' },
              { label: 'Cripto', value: current?.crypto || 0, color: '#f97316' },
            ],
          },
        ].map(({ label, total, diff, color, dimColor, icon, items }) => (
          <div key={label} style={{ background: dimColor, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {icon}
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 3 }}>{formatEuro(total)}</p>
            <p style={{ fontSize: '0.72rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: diff >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 10 }}>
              {diff >= 0 ? '+' : ''}{formatEuro(diff)} vs {baseMonthName}
            </p>
            <div style={{ borderTop: '1px solid var(--wa-06)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.filter(i => i.value > 0).map(i => (
                <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 2, background: i.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flex: 1 }}>{i.label}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(i.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Objetivo */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={12} color="var(--green)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Objetivo {year}:</span>
            <EditGoal value={goal} onSave={saveGoal} />
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: goalMet ? 'var(--green)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatEuro(totalSaved)}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{
            width: `${Math.max(0, Math.min(progress, 100))}%`,
            background: goalMet
              ? 'linear-gradient(90deg,var(--green),#22d3ee)'
              : progress > 60 ? 'linear-gradient(90deg,var(--accent),#a78bfa)'
              : 'linear-gradient(90deg,#f97316,var(--accent))',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Meta mensal: {formatEuro(goal / 12, 0)}</span>
          {goalMet
            ? <span style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700 }}>✓ Meta atingida!</span>
            : <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Faltam {formatEuro(goal - totalSaved)}</span>}
        </div>
      </div>

      {/* Mini gráfico */}
      <div>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 8 }}>
          Evolução {year}
        </p>
        <ErrorBoundary name="chart:savings-bar" variant="chart">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }} barSize={13} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <ReferenceLine y={0} stroke="var(--wa-12)" strokeWidth={1} />
              <Tooltip content={<SavingsTooltip />} cursor={{ fill: 'var(--wa-03)' }} />
              <Bar dataKey="certo"    stackId="a" fill="#818cf8" radius={[0,0,0,0]} />
              <Bar dataKey="arrisado" stackId="a" fill="#4ade80" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ErrorBoundary>
      </div>
    </div>
  )
}
