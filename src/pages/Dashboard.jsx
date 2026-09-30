import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, ArrowUpRight,
  ChevronLeft, ChevronRight, Shield,
} from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import {
  AreaChart, Area, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import {
  formatEuro, MONTHS, MONTHS_SHORT, getMK, compareMK,
  calcBancoTotal, calcSavingsTotal, calcPPRTotal,
  calcHoldingsTotal, calcBolsosTotal, calcAforroTotal, calcCryptoTotal,
} from '../data/initialData.js'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { getCategoryColors, CATEGORY_LABELS } from '../data/categories.js'
import CustomTooltip       from '../components/dashboard/CustomTooltip.jsx'
import KPICard             from '../components/dashboard/KPICard.jsx'
import CategoryRow         from '../components/dashboard/CategoryRow.jsx'
import MonthNav            from '../components/dashboard/MonthNav.jsx'
import CompositionChart    from '../components/dashboard/CompositionChart.jsx'
import SavingsSection      from '../components/dashboard/SavingsSection.jsx'
import DebtsDashSection    from '../components/dashboard/DebtsDashSection.jsx'
import renderActiveShape   from '../components/dashboard/renderActiveShape.jsx'
import BenchmarkCard       from '../components/dashboard/BenchmarkCard.jsx'
import RemindersBanner     from '../components/dashboard/RemindersBanner.jsx'
import AllocationSection   from '../components/dashboard/AllocationSection.jsx'
import SavingsRateCard     from '../components/dashboard/SavingsRateCard.jsx'
import PlanVsRealCard      from '../components/dashboard/PlanVsRealCard.jsx'
import EmergencyFundCard   from '../components/dashboard/EmergencyFundCard.jsx'
import UpcomingEventsCard  from '../components/dashboard/UpcomingEventsCard.jsx'
import GoalsCard           from '../components/dashboard/GoalsCard.jsx'
import YearCompareCard     from '../components/dashboard/YearCompareCard.jsx'
import { useInflation }    from '../hooks/useInflation.js'
import { useBenchmarks }   from '../hooks/useBenchmarks.js'
import { realValueIn, totalInflation } from '../utils/calc/inflationCalc.js'

// ── Dashboard ──────────────────────────────────────────────────
// Orquestração da página: deriva snapshots enriquecidos (Aforro/PPR
// calculados ao vivo porque não estão nos snapshots gravados), monta
// os `liveCategories` ao mês activo, calcula KPIs (Δ vs mês anterior,
// melhor categoria, taxa segura) e delega as peças visuais aos
// componentes em `components/dashboard/`.
export default function Dashboard() {
  const { data, saveData, exchangeRates, ratesUpdatedAt, setPage } = useApp()
  const [activeCategory, setActiveCategory] = useState(null)
  const [activePieIndex, setActivePieIndex] = useState(null)
  const [refMK,          setRefMK]          = useState(null)
  const [refPickerYear,  setRefPickerYear]  = useState(null)

  const { rates: inflationRates } = useInflation()
  const { spyData, psi20Data, getReturn } = useBenchmarks()

  const patrimony = data?.patrimony || {}
  const { startOfYear = 0 } = patrimony

  const year      = data?.currentYear  ?? new Date().getFullYear()
  const month     = data?.currentMonth ?? new Date().getMonth()
  const mk        = getMK(year, month)
  const monthName = MONTHS[month]

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setRefMK(null); setRefPickerYear(null) }, [year])

  // ── Categorias ao vivo (memoized — evita recalcular em re-renders sem mudança de dados) ──
  const platforms = data?.banks?.platforms || []
  const { liveCategories, liveSnap } = useMemo(() => {
    // Cores vêm de src/data/categories.js (com as personalizações do
    // utilizador aplicadas), não hardcoded aqui.
    const col = getCategoryColors(data)
    const cats = [
      { id: 'poupanca', name: CATEGORY_LABELS.poupanca, color: col.poupanca, value: calcSavingsTotal(platforms, mk, exchangeRates) },
      { id: 'aforro',   name: CATEGORY_LABELS.aforro,   color: col.aforro,   value: calcAforroTotal(data?.aforro, mk) },
      { id: 'acoes',    name: CATEGORY_LABELS.acoes,    color: col.acoes,    value: calcHoldingsTotal(data?.stocks?.acoes?.holdings, mk, exchangeRates) },
      { id: 'etfs',     name: CATEGORY_LABELS.etfs,     color: col.etfs,     value: calcHoldingsTotal(data?.stocks?.etfs?.holdings, mk, exchangeRates) + calcBolsosTotal(data?.stocks?.bolsos, mk) },
      { id: 'ppr',      name: CATEGORY_LABELS.ppr,      color: col.ppr,      value: calcPPRTotal(data?.ppr?.platforms || [], mk) },
      { id: 'banco',    name: CATEGORY_LABELS.banco,    color: col.banco,    value: calcBancoTotal(platforms, mk, exchangeRates) },
      { id: 'crypto',   name: CATEGORY_LABELS.crypto,   color: col.crypto,   value: calcCryptoTotal(data?.crypto, mk) },
    ]
    return { liveCategories: cats, liveSnap: Object.fromEntries(cats.map(c => [c.id, c.value])) }
  }, [data, exchangeRates, mk]) // eslint-disable-line react-hooks/exhaustive-deps -- platforms/mk derived from data
  const liveTotal = liveCategories.reduce((s, c) => s + c.value, 0)

  // ── Deltas vs referência ───────────────────────────────────
  const yearMonthSnaps = data?.years?.[year]?.months || {}
  const currentSnap = yearMonthSnaps[month] ?? liveSnap

  const allDataYears = Object.keys(data?.years || {}).map(Number).sort()

  // Default: Janeiro do ano atual; se não existir, o snapshot mais antigo disponível
  let firstSnapMK = null
  const janThisYear = getMK(year, 0)
  if (data?.years?.[year]?.months?.[0] && compareMK(janThisYear, getMK(year, month)) < 0) {
    firstSnapMK = janThisYear
  } else {
    outer: for (const y of allDataYears) {
      const yMonths = data?.years?.[y]?.months || {}
      for (let m = 0; m < 12; m++) {
        if (yMonths[m] && compareMK(getMK(y, m), getMK(year, month)) < 0) {
          firstSnapMK = getMK(y, m); break outer
        }
      }
    }
  }
  const minPickerYear  = allDataYears[0] ?? year
  const maxPickerYear  = year
  const pickerYear     = Math.min(Math.max(refPickerYear ?? (firstSnapMK ? Number(firstSnapMK.split('-')[0]) : year), minPickerYear), maxPickerYear)
  const activeRefMK    = refMK ?? firstSnapMK
  const refSnapRaw     = activeRefMK
    ? (() => { const [ry,rm] = activeRefMK.split('-').map(Number); return data?.years?.[ry]?.months?.[rm] || null })()
    : null

  const enrichSnap = (snap, snapMK) => snap ? {
    ...snap,
    aforro: calcAforroTotal(data?.aforro, snapMK),
    ppr:    calcPPRTotal(data?.ppr?.platforms || [], snapMK),
  } : null

  const refSnap              = enrichSnap(refSnapRaw, activeRefMK)
  const currentSnapEnriched  = enrichSnap(currentSnap, mk)

  const monthProfit = (currentSnapEnriched && refSnap) ? {
    poupanca: (currentSnapEnriched.poupanca||0) - (refSnap.poupanca||0),
    aforro:   (currentSnapEnriched.aforro  ||0) - (refSnap.aforro  ||0),
    acoes:    (currentSnapEnriched.acoes   ||0) - (refSnap.acoes   ||0),
    etfs:     (currentSnapEnriched.etfs    ||0) - (refSnap.etfs    ||0),
    ppr:      (currentSnapEnriched.ppr     ||0) - (refSnap.ppr     ||0),
    crypto:   (currentSnapEnriched.crypto  ||0) - (refSnap.crypto  ||0),
    banco:    (currentSnapEnriched.banco   ||0) - (refSnap.banco   ||0),
  } : { poupanca:0, aforro:0, acoes:0, etfs:0, ppr:0, crypto:0, banco:0 }

  const categories = liveCategories.map(c => ({
    ...c,
    percent: liveTotal > 0 ? (c.value / liveTotal) * 100 : 0,
  }))

  // ── KPI computations ──────────────────────────────────────
  const prevMonthIdx  = month === 0 ? 11 : month - 1
  const prevMonthYear = month === 0 ? year - 1 : year
  const prevSnapRaw   = data?.years?.[prevMonthYear]?.months?.[prevMonthIdx]
  const prevSnapMK    = getMK(prevMonthYear, prevMonthIdx)
  const prevSnapEnr   = prevSnapRaw ? {
    ...prevSnapRaw,
    aforro: calcAforroTotal(data?.aforro, prevSnapMK),
    ppr:    calcPPRTotal(data?.ppr?.platforms || [], prevSnapMK),
  } : null
  const prevTotal     = prevSnapEnr
    ? (prevSnapEnr.banco||0)+(prevSnapEnr.poupanca||0)+(prevSnapEnr.aforro||0)+(prevSnapEnr.acoes||0)+(prevSnapEnr.etfs||0)+(prevSnapEnr.ppr||0)+(prevSnapEnr.crypto||0)
    : null
  const monthDelta    = prevTotal !== null ? liveTotal - prevTotal : null
  const monthDeltaPct = prevTotal !== null && prevTotal > 0 ? ((liveTotal - prevTotal) / prevTotal) * 100 : null

  const bestCat = [...categories].filter(c => (monthProfit[c.id] || 0) > 0)
    .sort((a, b) => (monthProfit[b.id] || 0) - (monthProfit[a.id] || 0))[0] || null

  const certoValue  = (liveCategories.find(c => c.id === 'poupanca')?.value || 0)
                    + (liveCategories.find(c => c.id === 'aforro')?.value   || 0)
                    + (liveCategories.find(c => c.id === 'ppr')?.value      || 0)
  const savingsRate = liveTotal > 0 ? (certoValue / liveTotal) * 100 : 0

  // ── Chart data ─────────────────────────────────────────────
  const monthly = MONTHS_SHORT.map((m, i) => {
    const snap = yearMonthSnaps[i]
    if (!snap) return { month: m, total: null }
    const snapMK     = getMK(year, i)
    const snapAforro = calcAforroTotal(data?.aforro, snapMK)
    const snapPPR    = calcPPRTotal(data?.ppr?.platforms || [], snapMK)
    const snapTotal  = (snap.banco||0) + (snap.poupanca||0) + snapAforro + snapPPR + (snap.acoes||0) + (snap.etfs||0) + (snap.crypto||0)
    return { month: m, total: snapTotal, ...snap, aforro: snapAforro, ppr: snapPPR }
  }).filter(m => m.total !== null)

  const refTotal   = refSnap
    ? (refSnap.banco||0)+(refSnap.poupanca||0)+(refSnap.aforro||0)+(refSnap.acoes||0)+(refSnap.etfs||0)+(refSnap.ppr||0)+(refSnap.crypto||0)
    : (startOfYear || 0)
  const profitPct  = refTotal > 0 ? ((liveTotal - refTotal) / refTotal) * 100 : 0
  const isUp       = liveTotal >= refTotal

  // ── Inflação (valor real) ─────────────────────────────────
  const refYear  = activeRefMK ? Number(activeRefMK.split('-')[0]) : null
  const hasInfl  = refYear != null && refYear !== year && Object.keys(inflationRates).length > 0
  const realTotal = hasInfl ? realValueIn(liveTotal, inflationRates, refYear, year) : null
  const inflPct   = hasInfl ? totalInflation(inflationRates, refYear, year) : null

  // ── Benchmarks ────────────────────────────────────────────
  const portfolioReturn = activeRefMK && refTotal > 0 ? (liveTotal - refTotal) / refTotal : null
  const spyReturn   = getReturn(spyData,   activeRefMK, mk)
  const psi20Return = getReturn(psi20Data, activeRefMK, mk)
  const hasBenchmarks = spyReturn != null || psi20Return != null

  // O gráfico tem 3 modos: total (activeCategory null), uma categoria, ou
  // 'all' — todas as categorias em simultâneo. O Total fica de fora do modo
  // 'all' de propósito: sendo a soma, é várias vezes maior e esmagaria as
  // categorias contra o eixo.
  const showAllLines = activeCategory === 'all'
  const chartData  = (activeCategory && !showAllLines)
    ? monthly.map(m => ({ ...m, total: m[activeCategory] || 0 }))
    : monthly
  const activeColor = (activeCategory && !showAllLines)
    ? categories.find(c => c.id === activeCategory)?.color
    : 'var(--accent)'
  const chartSubtitle = showAllLines
    ? 'Todas as categorias'
    : activeCategory
      ? liveCategories.find(c => c.id === activeCategory)?.name
      : 'Total Património'

  const refLabel = activeRefMK
    ? `vs. ${MONTHS_SHORT[Number(activeRefMK.split('-')[1])]} ${activeRefMK.split('-')[0]}`
    : 'vs. início do ano'

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {monthName} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{year}</span>
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Visão geral do teu património
            {ratesUpdatedAt != null && (
              <span title="Câmbios e preços cripto voltam a atualizar-se a cada 30 min" style={{ opacity: 0.75 }}>
                {' · '}câmbios das {new Date(ratesUpdatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        {data && <MonthNav data={data} saveData={saveData} />}
      </div>

      {/* ── Lembretes ── */}
      <RemindersBanner />

      {/* ── Hero ── */}
      <div className="card" style={{
        padding: '28px 32px',
        // var(--bg-elevated) = #14141a no escuro (o valor antigo) e branco no claro
        background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, var(--bg-elevated) 60%)',
        borderColor: 'rgba(99,102,241,0.22)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:240, height:240,
          background:'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />

        <p style={{ fontSize: '0.6rem', color: 'rgba(129,140,248,0.75)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 10 }}>
          Total Património
        </p>
        <p style={{ fontSize: '2.9rem', fontWeight: 800, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: 'var(--text)', lineHeight: 1, marginBottom: realTotal != null ? 6 : 14 }}>
          {formatEuro(liveTotal)}
        </p>
        {realTotal != null && (
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10, fontVariantNumeric: 'tabular-nums' }}>
            {formatEuro(realTotal)} em EUR de {refYear}
            <span style={{ marginLeft: 6, color: inflPct != null ? (inflPct >= 0 ? 'var(--red)' : 'var(--green)') : 'var(--text-muted)', fontSize: '0.7rem' }}>
              {inflPct != null ? `(inflação ${inflPct >= 0 ? '+' : ''}${(inflPct * 100).toFixed(1)}%)` : ''}
            </span>
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span className={`badge ${isUp ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.73rem', padding: '4px 10px', gap: 5 }}>
            {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isUp ? '+' : ''}{profitPct.toFixed(1)}%
          </span>
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            {refLabel} · {formatEuro(refTotal)}
          </span>
        </div>

        {/* Compact inline reference picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flexShrink: 0 }}>
            Comparar:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <button onClick={() => setRefPickerYear(pickerYear-1)} disabled={pickerYear<=minPickerYear}
              style={{ background:'none',border:'none',cursor:pickerYear<=minPickerYear?'default':'pointer',color:pickerYear<=minPickerYear?'var(--wa-12)':'var(--text-muted)',display:'flex',padding:'1px 2px',borderRadius:3 }}
              onMouseEnter={e=>{ if(pickerYear>minPickerYear) e.currentTarget.style.color='var(--text)' }}
              onMouseLeave={e=>{ if(pickerYear>minPickerYear) e.currentTarget.style.color='var(--text-muted)' }}>
              <ChevronLeft size={11}/>
            </button>
            <span style={{ fontSize:'0.72rem',fontWeight:700,color:'var(--text)',minWidth:30,textAlign:'center' }}>{pickerYear}</span>
            <button onClick={() => setRefPickerYear(pickerYear+1)} disabled={pickerYear>=maxPickerYear}
              style={{ background:'none',border:'none',cursor:pickerYear>=maxPickerYear?'default':'pointer',color:pickerYear>=maxPickerYear?'var(--wa-12)':'var(--text-muted)',display:'flex',padding:'1px 2px',borderRadius:3 }}
              onMouseEnter={e=>{ if(pickerYear<maxPickerYear) e.currentTarget.style.color='var(--text)' }}
              onMouseLeave={e=>{ if(pickerYear<maxPickerYear) e.currentTarget.style.color='var(--text-muted)' }}>
              <ChevronRight size={11}/>
            </button>
          </div>
          {MONTHS_SHORT.map((m, i) => {
            const thisMK   = getMK(pickerYear, i)
            const hasSnap  = !!(data?.years?.[pickerYear]?.months?.[i])
            const isFuture = compareMK(thisMK, getMK(year, month)) >= 0
            const disabled = !hasSnap || isFuture
            const isActive = thisMK === activeRefMK
            return (
              <button key={i} disabled={disabled}
                onClick={() => setRefMK(isActive && thisMK===firstSnapMK ? null : thisMK)}
                style={{
                  fontSize:'0.63rem', fontWeight: isActive?700:400,
                  padding:'2px 7px', borderRadius:5, textAlign:'center',
                  background: isActive?'rgba(129,140,248,0.22)':'transparent',
                  border:`1px solid ${isActive?'rgba(129,140,248,0.45)':'transparent'}`,
                  color: disabled?'var(--wa-15)':isActive?'var(--accent)':'var(--text-secondary)',
                  cursor: disabled?'default':'pointer', transition:'all 0.1s',
                }}
                onMouseEnter={e=>{ if(!disabled&&!isActive){e.currentTarget.style.background='var(--wa-06)';e.currentTarget.style.color='var(--text)'}}}
                onMouseLeave={e=>{ if(!disabled&&!isActive){e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-secondary)'}}}>
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <KPICard
          icon={monthDelta !== null && monthDelta >= 0
            ? <TrendingUp size={13} color="var(--green)" />
            : <TrendingDown size={13} color="var(--red)" />}
          label="Variação este mês"
          value={monthDelta !== null ? `${monthDelta >= 0 ? '+' : ''}${formatEuro(monthDelta)}` : '—'}
          sub={monthDeltaPct !== null
            ? `${monthDeltaPct >= 0 ? '+' : ''}${monthDeltaPct.toFixed(1)}% vs ${MONTHS_SHORT[prevMonthIdx]}`
            : 'Sem dados do mês anterior'}
          subUp={monthDelta !== null ? monthDelta >= 0 : undefined}
        />
        <KPICard
          icon={<ArrowUpRight size={13} color={bestCat?.color || 'var(--accent)'} />}
          label="Melhor categoria"
          value={bestCat ? bestCat.name : '—'}
          sub={bestCat ? `+${formatEuro(monthProfit[bestCat.id])} vs ${refLabel.replace('vs. ', '')}` : 'Sem variações positivas'}
          subUp={bestCat ? true : undefined}
        />
        <KPICard
          icon={<Shield size={13} color="#818cf8" />}
          label="Taxa de poupança segura"
          value={`${savingsRate.toFixed(1)}%`}
          sub={`${formatEuro(certoValue)} em ativos seguros`}
          subUp={undefined}
        />
      </div>

      {/* ── Benchmarks (opcional — só quando há dados) ── */}
      {hasBenchmarks && (
        <BenchmarkCard
          portfolioReturn={portfolioReturn}
          spyReturn={spyReturn}
          psi20Return={psi20Return}
          period={refLabel}
        />
      )}

      {/* ── Gráfico + Alocação & Categorias ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>

        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Área chart + Composição */}
        <div className="card" style={{ padding: '20px 22px' }}>
          {/* Area chart */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 1 }}>Evolução Mensal</h2>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {chartSubtitle} · {year}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button
                size="sm"
                onClick={() => setActiveCategory(null)}
                aria-pressed={activeCategory == null}
                style={activeCategory == null
                  ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(129,140,248,0.3)' }
                  : { background: 'transparent', color: 'var(--text-muted)' }}
              >
                Total
              </Button>
              <Button
                size="sm"
                onClick={() => setActiveCategory('all')}
                aria-pressed={showAllLines}
                style={showAllLines
                  ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(129,140,248,0.3)' }
                  : { background: 'transparent', color: 'var(--text-muted)' }}
              >
                Todas
              </Button>
            </div>
          </div>
          <ErrorBoundary name="chart:wealth-area" variant="chart">
            {showAllLines ? (
              <ResponsiveContainer width="100%" height={235}>
                <LineChart data={chartData} margin={{ top:5, right:4, left:8, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--wa-04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize:10,fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10,fill:'var(--text-muted)' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:v} width={34} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke:'var(--wa-08)',strokeWidth:1 }} />
                  <Legend
                    verticalAlign="bottom" height={26}
                    wrapperStyle={{ fontSize: '0.66rem' }}
                    formatter={v => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>} />
                  {liveCategories.map(c => (
                    <Line key={c.id} type="monotone" dataKey={c.id} name={c.name}
                      stroke={c.color} strokeWidth={1.8} dot={false}
                      activeDot={{ r:3.5, fill:c.color, strokeWidth:0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
            <ResponsiveContainer width="100%" height={195}>
              <AreaChart data={chartData} margin={{ top:5, right:4, left:8, bottom:0 }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={activeColor} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={activeColor} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--wa-04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize:10,fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10,fill:'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:v} width={34}
                  domain={[dataMin => Math.floor(dataMin * 0.97 / 1000) * 1000, 'auto']} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke:'var(--wa-08)',strokeWidth:1 }} />
                <Area type="monotone" dataKey="total" stroke={activeColor} strokeWidth={2.5}
                  fill="url(#areaGradient)" dot={false} activeDot={{ r:4,fill:activeColor,strokeWidth:0 }} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </ErrorBoundary>

          {/* Separator */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0 0' }} />

          {/* Composição Mensal inline */}
          <CompositionChart data={data} year={year} currentMonth={month} bare />
        </div>

        {/* Poupança */}
        {data && <SavingsSection data={data} saveData={saveData} />}

        </div>{/* fim coluna esquerda */}

        {/* Donut + Category rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Donut */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 1 }}>Alocação</h2>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>Distribuição actual</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ErrorBoundary name="chart:composition-pie" variant="chart">
                <PieChart width={120} height={120}>
                  <Pie data={categories} cx={55} cy={55} innerRadius={36} outerRadius={54}
                    dataKey="value" nameKey="name"
                    activeIndex={activePieIndex} activeShape={renderActiveShape}
                    onMouseEnter={(_,i)=>setActivePieIndex(i)}
                    onMouseLeave={()=>setActivePieIndex(null)}>
                    {categories.map(cat => (
                      <Cell key={cat.id} fill={cat.color} stroke="var(--bg)" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ErrorBoundary>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <span style={{ width:6,height:6,borderRadius:2,background:cat.color,flexShrink:0 }}/>
                    <span style={{ fontSize:'0.66rem',color:'var(--text-secondary)',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{cat.name}</span>
                    <span style={{ fontSize:'0.7rem',fontWeight:700,color:'var(--text)',fontVariantNumeric:'tabular-nums' }}>{cat.percent.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category rows */}
          <div className="card" style={{ padding: '14px 10px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px', marginBottom:6 }}>
              <p style={{ fontSize:'0.65rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600 }}>Por categoria</p>
              {activeCategory && <span style={{ fontSize:'0.62rem',color:'var(--accent)' }}>filtrado</span>}
            </div>
            {categories.map(cat => (
              <CategoryRow key={cat.id}
                label={cat.name} value={cat.value} percent={cat.percent} color={cat.color}
                profit={monthProfit[cat.id]}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              />
            ))}
            <p style={{ fontSize:'0.6rem',color:'var(--text-muted)',padding:'6px 12px 0',opacity:0.7 }}>
              Clica para filtrar o gráfico
            </p>
          </div>
        </div>
      </div>

      {/* ── Alocação alvo + taxa de poupança ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <AllocationSection
          categories={liveCategories}
          targets={data?.allocation?.targets}
          onSaveTargets={targets => saveData({ allocation: { ...(data?.allocation || {}), targets } })}
        />
        <SavingsRateCard data={data} saveData={saveData} liveTotal={liveTotal} year={year} month={month} />
        <PlanVsRealCard liveTotal={liveTotal} />
        <EmergencyFundCard
          liveSnap={liveSnap}
          monthlyExpenses={data?.profile?.monthlyExpenses}
          onSetExpenses={v => saveData({ profile: { ...(data?.profile || {}), monthlyExpenses: v } })}
        />
        <UpcomingEventsCard />
        <GoalsCard
          data={data}
          liveSnap={liveSnap}
          years={data?.years}
          year={year}
          month={month}
          goals={data?.goals}
          onSave={goals => saveData({ goals })}
        />
        <YearCompareCard data={data} />
      </div>

      {/* ── Dívidas (opcional) ── */}
      {data?.debtSettings?.showOnDashboard && (data?.debts?.length ?? 0) > 0 && (
        <DebtsDashSection data={data} setPage={setPage} mk={getMK(year, month)} />
      )}

    </div>
  )
}
