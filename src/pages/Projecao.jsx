import { useMemo } from 'react'
import { Rocket, Target, TrendingUp, Wallet, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { formatEuro, computeSnapshot } from '../data/initialData.js'
import { projectWealth, yearsToTarget, avgMonthlyDelta, avgInflation } from '../utils/calc/projectionCalc.js'
import { simulateScenario, valueAtYear, milestoneYears, netValue, yearsToTargetScenario, UNIT_OPTIONS } from '../utils/calc/etfSimCalc.js'
import { generateId as uid } from '../utils/id.js'
import { useInflation } from '../hooks/useInflation.js'
import { EditableField } from '../components/ui/EditableField.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'

// ── Página Projeção ────────────────────────────────────────────────
// Projeta o património total (juros compostos + contribuição mensal) em
// três cenários de retorno, desconta a inflação HICP média, e estima
// quando se atinge a meta. Parâmetros persistidos em `data.projection`.
// Suporta ainda linhas comparativas hipotéticas (`projection.scenarios`):
// cada uma com inicial, reforço periódico (semanas/meses/anos), retorno,
// TER e aumento anual — desenhadas no mesmo gráfico e na tabela de marcos.
const SCENARIO_SPREAD = 0.02 // pessimista/otimista = retorno ∓/± 2 p.p.

const PALETTE = ['#22d3ee', '#f472b6', '#fb923c', '#a78bfa', '#f87171', '#4ade80', '#60a5fa', '#facc15']

const DEFAULT_SCENARIO = () => ({
  initial: 1000, amount: 100, every: 1, unit: 'month',
  annualReturn: 0.07, ter: 0.002, stepUp: 0,
})

function ParamCard({ icon: Icon, label, children, hint }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', flex: '1 1 160px', minWidth: 150 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        <Icon size={11} /> {label}
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{children}</div>
      {hint && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 5, opacity: 0.8 }}>{hint}</div>}
    </div>
  )
}

function fmtAnos(anos) {
  if (anos == null) return '> 100 anos'
  if (anos === 0) return 'já atingida ✓'
  const y = Math.floor(anos)
  const m = Math.round((anos - y) * 12)
  if (y === 0) return `${m} meses`
  return m > 0 ? `${y} anos e ${m} meses` : `${y} anos`
}

function unitLabel(unit, every) {
  const opt = UNIT_OPTIONS.find(o => o.value === unit) || UNIT_OPTIONS[1]
  return every === 1 ? opt.singular : opt.plural
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{children}</span>
    </div>
  )
}

// Percentagem com até 2 casas, sem zeros à direita (0.025 → "2.5%")
const fmtPct = v => `${parseFloat(((v ?? 0) * 100).toFixed(2))}%`

export default function Projecao() {
  const { data, saveData, exchangeRates } = useApp()
  const { rates: inflationRates } = useInflation()

  const proj = data?.projection || {}
  const monthlyContribution = proj.monthlyContribution ?? 0
  const annualReturn        = proj.annualReturn ?? 0.05
  const target              = proj.target ?? 0
  const horizonYears        = proj.horizonYears ?? 25
  const showNet             = proj.showNet ?? false
  const scenarioList        = proj.scenarios || []

  const currentYear = data?.currentYear ?? new Date().getFullYear()
  const inflation   = avgInflation(inflationRates, 5)

  // Património actual: soma do snapshot do mês corrente (câmbios live p/ não-EUR)
  const initial = useMemo(() => {
    if (!data) return 0
    const snap = computeSnapshot(data, null, exchangeRates)
    return Object.values(snap).reduce((s, v) => s + (v || 0), 0)
  }, [data, exchangeRates])

  // Sugestão de contribuição: crescimento médio mensal do histórico
  const suggestion = useMemo(() => avgMonthlyDelta(data?.years), [data?.years])

  function setParam(key, value) {
    saveData({ projection: { ...proj, [key]: value } })
  }

  // ── Linhas comparativas ──────────────────────────────────
  const updScenario = (id, patch) =>
    setParam('scenarios', scenarioList.map(s => (s.id === id ? { ...s, ...patch } : s)))
  const removeScenario = id => setParam('scenarios', scenarioList.filter(s => s.id !== id))
  function addScenario() {
    const color = PALETTE[scenarioList.length % PALETTE.length]
    setParam('scenarios', [...scenarioList, { id: uid(), color, ...DEFAULT_SCENARIO(), nome: `Cenário ${scenarioList.length + 1}` }])
  }
  const cycleColor = s => {
    const idx = PALETTE.indexOf(s.color)
    updScenario(s.id, { color: PALETTE[(idx + 1) % PALETTE.length] })
  }

  // Séries mensais das linhas comparativas — cálculo leve (milissegundos),
  // recalculado a cada render; o React Compiler memoiza o que puder.
  const visibleScenarios = scenarioList.filter(s => !s.hidden)
  const simSeries = {}
  for (const s of visibleScenarios) {
    simSeries[s.id] = simulateScenario({
      initial: s.initial, amount: s.amount, every: s.every, unit: s.unit,
      annualReturn: s.annualReturn, ter: s.ter, stepUp: s.stepUp,
      years: horizonYears,
    })
  }

  // Guarda os parâmetros actuais como plano — o Dashboard passa a
  // comparar o património real com esta trajetória.
  function saveBaseline() {
    const now = new Date()
    saveData({ projection: { ...proj, baseline: {
      savedAt: now.toISOString(),
      startYear: now.getFullYear(), startMonth: now.getMonth(),
      initial, monthlyContribution, annualReturn,
    } } })
  }

  // ── Cenários do património real ──────────────────────────
  const scenarios = [
    { key: 'otim', label: 'Otimista',   ret: annualReturn + SCENARIO_SPREAD, color: 'var(--green)' },
    { key: 'base', label: 'Base',       ret: annualReturn,                   color: 'var(--accent)' },
    { key: 'pess', label: 'Pessimista', ret: Math.max(-0.99, annualReturn - SCENARIO_SPREAD), color: '#fbbf24' },
  ]

  const chartSeries = {}
  for (const s of scenarios) {
    chartSeries[s.key] = projectWealth({
      initial, monthlyContribution, annualReturn: s.ret,
      years: horizonYears, annualInflation: inflation,
    })
  }
  const chartData = chartSeries.base.map((_, i) => ({
    ano:  currentYear + i,
    otim: Math.round(chartSeries.otim[i].nominal),
    base: Math.round(chartSeries.base[i].nominal),
    pess: Math.round(chartSeries.pess[i].nominal),
    real: Math.round(chartSeries.base[i].real),
    ...Object.fromEntries(visibleScenarios.map(sc => [sc.id, Math.round(valueAtYear(simSeries[sc.id], i).value)])),
  }))

  const metas = scenarios.map(s => ({
    ...s,
    anos: yearsToTarget({ initial, monthlyContribution, annualReturn: s.ret, target }),
  }))

  // ── Tabela de marcos (só com linhas comparativas) ────────
  const marcos = milestoneYears(horizonYears)
  const tableRows = !visibleScenarios.length ? [] : [
    {
      id: '__real', nome: 'Património real', color: 'var(--accent)',
      at: y => ({
        value: Math.round(chartData[y]?.base ?? 0),
        invested: initial + monthlyContribution * 12 * y,
      }),
      metaAnos: yearsToTarget({ initial, monthlyContribution, annualReturn, target }),
    },
    ...visibleScenarios.map(s => ({
      id: s.id, nome: s.nome, color: s.color,
      at: y => valueAtYear(simSeries[s.id], y),
      metaAnos: yearsToTargetScenario({
        initial: s.initial, amount: s.amount, every: s.every, unit: s.unit,
        annualReturn: s.annualReturn, ter: s.ter, stepUp: s.stepUp,
      }, target),
    })),
  ]

  const scenarioName = key => scenarioList.find(x => x.id === key)?.nome || key
  const fmtCompact = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`

  const selectStyle = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5,
    color: 'var(--text)', fontSize: '0.68rem', padding: '2px 4px', cursor: 'pointer', outline: 'none',
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#34d399,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Rocket size={20} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>Projeção</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Crescimento projetado do património · inflação média HICP: {(inflation * 100).toFixed(1)}%/ano
          </p>
          <button onClick={saveBaseline}
            title="O Dashboard passa a comparar o património real com esta trajetória"
            style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 7, color: 'var(--accent)', padding: '4px 12px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>
            {proj.baseline ? 'Atualizar plano' : 'Guardar como plano'}
          </button>
          {proj.baseline?.savedAt && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>
              plano de {new Date(proj.baseline.savedAt).toLocaleDateString('pt-PT')}
            </span>
          )}
        </div>
      </div>

      {/* Parâmetros */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ParamCard icon={Wallet} label="Património actual" hint="Soma do snapshot do mês corrente">
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEuro(initial)}</span>
        </ParamCard>

        <ParamCard icon={TrendingUp} label="Contribuição mensal"
          hint={suggestion != null ? (
            <>Crescimento médio recente: {formatEuro(suggestion)}/mês{' '}
              <button onClick={() => setParam('monthlyContribution', Math.max(0, Math.round(suggestion)))}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.62rem', padding: 0, textDecoration: 'underline' }}>
                usar
              </button>
            </>
          ) : 'Quanto acrescentas por mês'}>
          <EditableField type="number" value={monthlyContribution}
            onSave={v => setParam('monthlyContribution', Math.max(0, v))}
            formatter={v => formatEuro(v)} width={90} fontSize="1rem" fontWeight={700} />
        </ParamCard>

        <ParamCard icon={TrendingUp} label="Retorno anual esperado" hint={`Cenários: ${((annualReturn - SCENARIO_SPREAD) * 100).toFixed(0)}% / ${(annualReturn * 100).toFixed(0)}% / ${((annualReturn + SCENARIO_SPREAD) * 100).toFixed(0)}%`}>
          <EditableField type="percent" value={annualReturn}
            onSave={v => setParam('annualReturn', Math.max(-0.5, Math.min(0.3, v)))}
            formatter={v => `${(v * 100).toFixed(1)}%`} width={70} fontSize="1rem" fontWeight={700} />
        </ParamCard>

        <ParamCard icon={Target} label="Meta" hint={target > 0 ? `Regra dos 4%: ${formatEuro(target * 0.04 / 12)}/mês de rendimento` : 'Define um objetivo de património'}>
          <EditableField type="number" value={target}
            onSave={v => setParam('target', Math.max(0, v))}
            formatter={v => (v > 0 ? formatEuro(v) : '—')} width={100} fontSize="1rem" fontWeight={700} />
        </ParamCard>

        <ParamCard icon={Rocket} label="Horizonte" hint="Anos projetados no gráfico">
          <EditableField type="number" value={horizonYears}
            onSave={v => setParam('horizonYears', Math.max(1, Math.min(60, Math.round(v))))}
            formatter={v => `${Math.round(v)} anos`} width={80} fontSize="1rem" fontWeight={700} />
        </ParamCard>
      </div>

      {/* Meta por cenário */}
      {target > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {metas.map(s => (
            <div key={s.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', flex: '1 1 170px' }}>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, fontWeight: 700, marginBottom: 4 }}>
                {s.label} · {(s.ret * 100).toFixed(0)}%/ano
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
                {fmtAnos(s.anos)}
              </div>
              {s.anos != null && s.anos > 0 && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  ~{Math.round(currentYear + s.anos)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gráfico */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 18px 8px' }}>
        <ErrorBoundary name="chart:projecao" variant="chart">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--wa-05)" vertical={false} />
              <XAxis dataKey="ano" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={46} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--wa-10)', borderRadius: 8, fontSize: '0.72rem' }}
                labelStyle={{ color: 'var(--text-muted)' }}
                formatter={(v, name) => [formatEuro(v), { otim: 'Otimista', base: 'Base', pess: 'Pessimista', real: 'Base (poder de compra actual)' }[name] || scenarioName(name)]}
              />
              {target > 0 && (
                <ReferenceLine y={target} stroke="#f472b6" strokeDasharray="4 4"
                  label={{ value: `Meta ${fmtCompact(target)}`, fill: '#f472b6', fontSize: 10, position: 'insideTopRight' }} />
              )}
              <Line type="monotone" dataKey="otim" stroke="var(--green)" strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
              <Line type="monotone" dataKey="base" stroke="#818cf8" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="pess" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
              <Line type="monotone" dataKey="real" stroke="#818cf8" strokeWidth={1.2} dot={false} strokeDasharray="5 4" strokeOpacity={0.55} />
              {visibleScenarios.map(s => (
                <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color} strokeWidth={1.8} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ErrorBoundary>
        <p style={{ margin: '4px 6px 8px', fontSize: '0.62rem', color: 'var(--text-muted)', opacity: 0.7 }}>
          Linha tracejada: cenário base em euros de hoje (descontada a inflação média dos últimos anos).
          Projeção determinística — os mercados não sobem em linha reta; usa os cenários como intervalo, não como promessa.
        </p>
      </div>

      {/* Linhas comparativas */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>Linhas comparativas</h2>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Cenários hipotéticos independentes — ex.: ETF com reforço semanal, TER diferente
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={addScenario} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8,
            color: 'var(--accent)', padding: '6px 14px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
          }}>
            <Plus size={13} /> Nova linha
          </button>
        </div>

        {scenarioList.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {scenarioList.map(s => {
              const serie = simSeries[s.id]
              const last  = serie?.at(-1)
              return (
                <div key={s.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '12px 14px', flex: '1 1 240px', minWidth: 230, maxWidth: 340,
                  display: 'flex', flexDirection: 'column', gap: 8, opacity: s.hidden ? 0.55 : 1,
                }}>
                  {/* Topo: cor + nome + ações */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => cycleColor(s)} title="Mudar cor"
                      style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <EditableField type="text" value={s.nome} onSave={v => updScenario(s.id, { nome: v || s.nome })}
                        fontSize="0.82rem" fontWeight={700} color="var(--text)" width={130} />
                    </div>
                    <button onClick={() => updScenario(s.id, { hidden: !s.hidden })} title={s.hidden ? 'Mostrar no gráfico' : 'Ocultar do gráfico'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                      {s.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => removeScenario(s.id)} title="Apagar (Ctrl+Z para desfazer)"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Parâmetros */}
                  <FieldRow label="Investimento inicial">
                    <EditableField type="currency" value={s.initial} onSave={v => updScenario(s.id, { initial: Math.max(0, v) })} size="sm" />
                  </FieldRow>
                  <FieldRow label="Reforço">
                    <EditableField type="currency" value={s.amount} onSave={v => updScenario(s.id, { amount: Math.max(0, v) })} size="sm" width={65} />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>a cada</span>
                    <EditableField type="number" value={s.every}
                      onSave={v => updScenario(s.id, { every: Math.max(1, Math.min(52, Math.round(v))) })} size="xs" width={30} />
                    <select value={s.unit} onChange={e => updScenario(s.id, { unit: e.target.value })} style={selectStyle}>
                      {UNIT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{unitLabel(o.value, s.every ?? 1)}</option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Retorno anual esperado">
                    <EditableField type="percent" value={s.annualReturn}
                      onSave={v => updScenario(s.id, { annualReturn: Math.max(-0.5, Math.min(0.3, v)) })}
                      formatter={fmtPct} size="sm" width={55} />
                  </FieldRow>
                  <FieldRow label="TER (custos do ETF)">
                    <EditableField type="percent" value={s.ter}
                      onSave={v => updScenario(s.id, { ter: Math.max(0, Math.min(0.05, v)) })}
                      formatter={fmtPct} size="sm" width={55} />
                  </FieldRow>
                  <FieldRow label="Aumento anual do reforço">
                    <EditableField type="percent" value={s.stepUp}
                      onSave={v => updScenario(s.id, { stepUp: Math.max(0, Math.min(0.5, v)) })}
                      formatter={fmtPct} size="sm" width={55} />
                  </FieldRow>

                  {/* Resumo no horizonte */}
                  {last && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Aos {horizonYears} anos</span>
                      <span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                          {formatEuro(showNet ? netValue(last) : last.value)}
                        </span>
                        {last.invested > 0 && (
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                            {((showNet ? netValue(last) : last.value) / last.invested * 100 - 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabela de marcos (real vs. linhas comparativas) */}
      {tableRows.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Marcos
            </span>
            <button onClick={() => setParam('showNet', !showNet)} style={{
              background: showNet ? 'var(--accent-dim)' : 'transparent',
              border: `1px solid ${showNet ? 'rgba(129,140,248,0.35)' : 'var(--border)'}`,
              borderRadius: 7, color: showNet ? 'var(--accent)' : 'var(--text-muted)',
              padding: '3px 10px', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 600,
            }}>
              Líquido de imposto (28%)
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Linha
                </th>
                {marcos.map(y => (
                  <th key={y} style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    {y} {y === 1 ? 'ano' : 'anos'}
                  </th>
                ))}
                {target > 0 && (
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Meta
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: r.color, marginRight: 7 }} />
                    {r.nome}
                  </td>
                  {marcos.map(y => {
                    const p = r.at(y)
                    const v = showNet ? netValue(p) : p.value
                    return (
                      <td key={y} style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(v)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontVariantNumeric: 'tabular-nums' }}>
                          inv. {formatEuro(p.invested)}
                        </div>
                      </td>
                    )
                  })}
                  {target > 0 && (
                    <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                      {fmtAnos(r.metaAnos)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {showNet && (
            <p style={{ margin: '6px 6px 0', fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.7 }}>
              Líquido: mais-valias (valor − investido) tributadas a 28% — aproximação; no património real nem tudo é tributável.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
