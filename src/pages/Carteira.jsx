import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import {
  formatEuro, formatPct, formatPP, mkToNum, holdingGastoAtMk, holdingQtyAtMk,
} from '../data/initialData.js'
import { portfolioXirr } from '../utils/calc/xirrCalc.js'
import { benchmarkXirr } from '../utils/calc/benchmarkCalc.js'
import { useBenchmarks } from '../hooks/useBenchmarks.js'
import DividendsSection from '../components/carteira/DividendsSection.jsx'
import {
  ArrowUpDown, RotateCcw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import PositionRow from '../components/carteira/PositionRow.jsx'
import { profitColor, calcRecebido, earliestBuyMk, TAX_RATE } from '../components/carteira/utils.js'

// Ícone de ordenação — puramente decorativo: o estado real vai em
// `aria-sort` no <th>, por isso fica escondido dos leitores de ecrã.
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={9} aria-hidden="true" style={{ opacity: 0.5, marginLeft: 3, verticalAlign: 'middle' }} />
  return sortDir === 1
    ? <ChevronUp   size={9} aria-hidden="true" style={{ color: 'var(--accent)', marginLeft: 3, verticalAlign: 'middle' }} />
    : <ChevronDown size={9} aria-hidden="true" style={{ color: 'var(--accent)', marginLeft: 3, verticalAlign: 'middle' }} />
}

// ── Página Carteira (orquestração) ────────────────────────────────
// Lista todas as posições (Ações + ETFs) numa única tabela com filtro
// por estado (todas/activas/vendidas), ordenação por coluna ou custom
// via drag-and-drop, e filtro de ano aplicado às posições vendidas.
// O footer agrega totais (investido/recebido/lucro bruto/líquido).
export default function Carteira() {
  const { data, saveData, exchangeRates } = useApp()

  const defaultYear = data?.currentYear ?? new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(defaultYear)
  // null = todos os anos
  const [yearFilter, setYearFilter] = useState(defaultYear)

  // Sincronizar com o ano global quando muda noutras páginas.
  useEffect(() => {
    const y = data?.currentYear ?? new Date().getFullYear()
    setSelectedYear(y) // eslint-disable-line react-hooks/set-state-in-effect
    setYearFilter(y)    
  }, [data?.currentYear])

  const stocks = data?.stocks || {}
  const acoesH = stocks.acoes?.holdings || []
  const etfsH  = stocks.etfs?.holdings  || []

  // ── Persistência ─────────────────────────────────────────────
  function saveAcoes(newH) {
    const clean = newH.map(({ _color, ...r }) => r)
    saveData({ stocks: { ...stocks, acoes: { ...(stocks.acoes || {}), holdings: clean } } })
  }
  function saveEtfs(newH) {
    const clean = newH.map(({ _color, ...r }) => r)
    saveData({ stocks: { ...stocks, etfs: { ...(stocks.etfs || {}), holdings: clean } } })
  }
  function updateHolding(h, src) {
    if (src === 'acoes') saveAcoes(acoesH.map(x => x.id === h.id ? h : x))
    else                 saveEtfs(etfsH.map(x => x.id === h.id ? h : x))
  }

  // ── Filtro e ordenação ───────────────────────────────────────
  const [filter,  setFilter]  = useState('all')   // 'all' | 'active' | 'sold'
  const [sortCol, setSortCol] = useState('ticker')
  const [sortDir, setSortDir] = useState(1)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  // Juntar todas as posições com tag `_src` para saber de onde vêm.
  const allPositions = [
    ...acoesH.map(h => ({ ...h, _src: 'acoes' })),
    ...etfsH.map(h => ({ ...h, _src: 'etfs' })),
  ]

  // Filtro por ano aplica-se apenas às vendidas (activas são sempre visíveis).
  function matchesYearFilter(h) {
    if (!yearFilter) return true
    if (!h.sellMk) return true
    const [y] = h.sellMk.split('-').map(Number)
    return y === yearFilter
  }

  const filtered = allPositions.filter(h => {
    if (filter === 'active') return !h.sellMk
    if (filter === 'sold')   return !!h.sellMk && matchesYearFilter(h)
    return matchesYearFilter(h)
  })

  // 'custom' = ordem manual guardada no data store (ativada pelo drag).
  const sorted = sortCol === 'custom'
    ? [...filtered]
    : [...filtered].sort((a, b) => {
        let va, vb
        if (sortCol === 'ticker')       { va = a.ticker;                            vb = b.ticker }
        else if (sortCol === 'gasto')   { va = holdingGastoAtMk(a, null);           vb = holdingGastoAtMk(b, null) }
        else if (sortCol === 'lucro')   {
          va = a.sellMk ? calcRecebido(a) - holdingGastoAtMk(a, null) : -Infinity
          vb = b.sellMk ? calcRecebido(b) - holdingGastoAtMk(b, null) : -Infinity
        }
        else if (sortCol === 'recebido') { va = a.sellMk ? calcRecebido(a) : 0;      vb = b.sellMk ? calcRecebido(b) : 0 }
        else if (sortCol === 'buyMk')    { va = mkToNum(earliestBuyMk(a) || '0-0'); vb = mkToNum(earliestBuyMk(b) || '0-0') }
        else if (sortCol === 'sellMk')   { va = mkToNum(a.sellMk || '0-0');         vb = mkToNum(b.sellMk || '0-0') }
        if (va < vb) return -sortDir
        if (va > vb) return  sortDir
        return 0
      })

  const displayRows = sorted

  // Reordena mantendo a distribuição por tipo (Acoes/ETFs) e passa a
  // `sortCol = 'custom'` para não reordenar automaticamente de novo.
  // Usado pelo drag-and-drop e pelas setas ↑/↓ na pega de cada linha.
  //
  // IMPORTANTE: uma única chamada a saveData. Com duas (saveAcoes seguido
  // de saveEtfs) ambas partiriam do mesmo `stocks` desta closure e a
  // segunda reporia a ordem antiga das ações, anulando a primeira.
  function applyDragReorder(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const arr = [...sorted]
    const [item] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, item)

    // Nova ordem de `src`, seguida das posições que não estavam na vista
    // (filtradas por estado/ano) para nenhuma se perder.
    const reorder = (holdings, src) => {
      const ids  = arr.filter(h => h._src === src).map(h => h.id)
      const seen = new Set(ids)
      const byId = new Map(holdings.map(h => [h.id, h]))
      return [
        ...ids.map(id => byId.get(id)).filter(Boolean),
        ...holdings.filter(h => !seen.has(h.id)),
      ].map(({ _color, ...r }) => r)
    }

    saveData({
      stocks: {
        ...stocks,
        acoes: { ...(stocks.acoes || {}), holdings: reorder(acoesH, 'acoes') },
        etfs:  { ...(stocks.etfs  || {}), holdings: reorder(etfsH,  'etfs')  },
      },
    })
    setSortCol('custom')
  }

  // ── Totais (filtrados pelo ano selecionado) ──────────────────
  const vendidas        = allPositions.filter(h => h.sellMk && matchesYearFilter(h))
  const totalGasto      = vendidas.reduce((s, h) => s + holdingGastoAtMk(h, null), 0)
  const totalRecebido   = vendidas.reduce((s, h) => s + calcRecebido(h), 0)
  const totalLucroBruto = totalRecebido - totalGasto
  const totalImposto    = totalLucroBruto > 0 ? totalLucroBruto * TAX_RATE : 0
  const totalLucroLiq   = totalLucroBruto - totalImposto
  const lucroPct        = totalGasto > 0 ? totalLucroBruto / totalGasto : 0

  // ── TIR anual (XIRR) de toda a carteira — vida inteira, ignora o
  // filtro de ano: compras, vendas, dividendos e o valor de mercado das
  // posições activas, ponderados pelas datas.
  const tir = portfolioXirr(allPositions, h => {
    const qty = holdingQtyAtMk(h, null)
    const fx  = (h.currency && h.currency !== 'EUR') ? (exchangeRates?.[h.currency] ?? 1) : 1
    return qty * (h.price || 0) * fx
  })

  // ── Benchmark justo: os mesmos fluxos aplicados ao S&P 500 (SPY)
  const { spyData } = useBenchmarks()
  const spyComp = spyData?.points?.length ? benchmarkXirr(allPositions, spyData.points) : null

  // ── Estilos locais de header/tabs ────────────────────────────
  const th = (col, { right = false, ...extra } = {}) => ({
    padding: '7px 8px', fontSize: '0.6rem', fontWeight: 600,
    color: sortCol === col ? 'var(--accent)' : 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--wa-07)',
    textAlign: right ? 'right' : 'left',
    whiteSpace: 'nowrap',
    background: sortCol === col ? 'rgba(129,140,248,0.04)' : 'transparent',
    ...extra,
  })

  // Cabeçalho ordenável: <th> com aria-sort + <button> interno, para a
  // ordenação funcionar com teclado (um <th onClick> não é focável).
  const sortTh = (col, label, right = false) => (
    <th
      key={col}
      scope="col"
      aria-sort={sortCol === col ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
      style={th(col, { right })}>
      <button
        type="button"
        onClick={() => toggleSort(col)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
          textTransform: 'inherit', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center',
          marginLeft: right ? 'auto' : 0,
        }}>
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </button>
    </th>
  )

  const tabBtn = (id, label, count) => (
    <Button key={id} onClick={() => setFilter(id)}
      aria-pressed={filter === id}
      style={{
        background:  filter === id ? 'var(--accent-dim)' : 'transparent',
        color:       filter === id ? 'var(--accent)' : 'var(--text-muted)',
        border:      filter === id ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent',
        borderRadius: 6, padding: '4px 12px', fontSize: '0.72rem',
        fontWeight: filter === id ? 600 : 400, gap: 5,
      }}>
      {label}
      <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>({count})</span>
    </Button>
  )

  // Cards de resumo das vendas (pre-calculados para simplificar o JSX).
  const summaryCards = [
    { label: 'Posições vendidas',        value: String(vendidas.length),                                                    color: 'var(--yellow)' },
    { label: 'Total investido (vendas)', value: formatEuro(totalGasto),                                                     color: 'var(--text-muted)' },
    { label: 'Total recebido',           value: formatEuro(totalRecebido),                                                  color: 'var(--text)' },
    { label: 'Lucro bruto',              value: `${totalLucroBruto >= 0 ? '+' : ''}${formatEuro(totalLucroBruto)}`,         color: profitColor(lucroPct),
      sub: formatPct(lucroPct, { signed: true }) },
    { label: 'Lucro líquido (−28% IRS)', value: `${totalLucroLiq >= 0 ? '+' : ''}${formatEuro(totalLucroLiq)}`,              color: profitColor(lucroPct),
      sub: totalImposto > 0 ? `IRS: −${formatEuro(totalImposto)}` : undefined, subColor: 'var(--red)' },
    { label: 'TIR anual (XIRR)', value: tir != null ? formatPct(tir, { signed: true }) : '—',
      color: profitColor(tir ?? 0), sub: 'vida inteira, com dividendos' },
    ...(spyComp != null && tir != null ? [{
      label: 'vs. S&P 500 (mesmos fluxos)',
      value: formatPct(spyComp.rate, { signed: true }),
      color: tir >= spyComp.rate ? 'var(--green)' : 'var(--yellow)',
      sub: tir >= spyComp.rate
        ? `estás ${formatPP((tir - spyComp.rate) * 100)} à frente`
        : `estás ${formatPP((spyComp.rate - tir) * 100)} atrás · sem efeito cambial`,
    }] : []),
  ]

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Título + seletor de ano */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Carteira
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Todas as posições em Ações e ETFs
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-elevated)', border: '1px solid var(--wa-08)', borderRadius: 8, padding: '4px 6px' }}>
          <button
            type="button"
            aria-label="Ano anterior"
            onClick={() => { const y = (yearFilter ?? selectedYear) - 1; setSelectedYear(y); setYearFilter(y) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px 4px', borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <ChevronLeft size={14} aria-hidden="true" />
          </button>

          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: yearFilter ? 'var(--text)' : 'var(--accent)', minWidth: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {yearFilter ?? 'Todos'}
          </span>

          <button
            type="button"
            aria-label="Ano seguinte"
            onClick={() => { const y = (yearFilter ?? selectedYear) + 1; setSelectedYear(y); setYearFilter(y) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px 4px', borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <ChevronRight size={14} aria-hidden="true" />
          </button>

          <div aria-hidden="true" style={{ width: 1, height: 14, background: 'var(--wa-10)', margin: '0 2px' }} />

          <button
            type="button"
            aria-pressed={!yearFilter}
            onClick={() => setYearFilter(null)}
            style={{
              background: !yearFilter ? 'var(--accent-dim)' : 'none',
              border: !yearFilter ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent',
              borderRadius: 5, cursor: 'pointer', padding: '2px 8px',
              fontSize: '0.68rem', fontWeight: 600,
              color: !yearFilter ? 'var(--accent)' : 'var(--text-muted)',
            }}
            onMouseEnter={e => { if (yearFilter) e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { if (yearFilter) e.currentTarget.style.color = 'var(--text-muted)' }}>
            Todos
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {summaryCards.map(({ label, value, color, sub, subColor }) => (
          <div key={label} className="card" style={{ padding: '12px 16px', flex: '1 1 150px', minWidth: 135 }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            {sub && <div style={{ fontSize: '0.62rem', color: subColor || color, marginTop: 1 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 0', flexWrap: 'wrap' }}>
          {tabBtn('all',    'Todas',    allPositions.filter(h => matchesYearFilter(h)).length)}
          {tabBtn('active', 'Activas',  allPositions.filter(h => !h.sellMk).length)}
          {tabBtn('sold',   'Vendidas', allPositions.filter(h =>  h.sellMk && matchesYearFilter(h)).length)}
          <div style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {sorted.length} posiç{sorted.length === 1 ? 'ão' : 'ões'}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Sem posições{filter !== 'all' ? ` (${filter === 'active' ? 'activas' : 'vendidas'})` : ''}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <caption style={{
                position: 'absolute', width: 1, height: 1, overflow: 'hidden',
                clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
              }}>
                Posições em Ações e ETFs, com valores de compra e venda.
                Use o menu de arrastar em cada linha para reordenar com o teclado.
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={{ ...th(''), width: 18, padding: '7px 2px' }}>
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ordem</span>
                  </th>
                  {sortTh('ticker', 'Ticker')}
                  <th scope="col" style={th('name')}>Nome</th>
                  <th scope="col" style={th('status', { textAlign: 'center' })}>Estado</th>
                  <th scope="col" style={th('qty',   { right: true })}>Qtd</th>
                  {sortTh('gasto', 'Investido', true)}
                  {sortTh('buyMk', 'Compra')}
                  <th scope="col" style={th('platform')}>Plataforma</th>
                  {sortTh('sellMk', 'Venda')}
                  <th scope="col" style={th('sellPrice', { right: true })}>Preço venda</th>
                  {sortTh('recebido', 'Recebido', true)}
                  {sortTh('lucro', 'Lucro bruto', true)}
                  <th scope="col" style={th('lucroliq', { right: true })}>Lucro líquido</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((h, idx) => (
                  <PositionRow
                    key={h.id}
                    h={h}
                    tipo={h._src}
                    onUpdate={updated => updateHolding(updated, h._src)}
                    isDragOver={overIdx === idx && dragIdx !== idx}
                    isDragging={dragIdx === idx}
                    rowIndex={idx}
                    rowCount={displayRows.length}
                    onMoveUp={idx > 0 ? () => applyDragReorder(idx, idx - 1) : null}
                    onMoveDown={idx < displayRows.length - 1 ? () => applyDragReorder(idx, idx + 1) : null}
                    dragProps={{
                      draggable: true,
                      onDragStart: e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx) },
                      onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== idx) setOverIdx(idx) },
                      onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverIdx(null) },
                      onDrop: e => { e.preventDefault(); applyDragReorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) },
                      onDragEnd: () => { setDragIdx(null); setOverIdx(null) },
                    }}
                  />
                ))}
              </tbody>

              {/* Footer com totais (só quando há vendidas na vista) */}
              {filter !== 'active' && vendidas.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--wa-025)' }}>
                    <td colSpan={5} style={{ padding: '8px 8px', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', borderTop: '1px solid var(--wa-07)' }}>
                      Total vendas
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--wa-07)' }}>
                      {formatEuro(totalGasto)}
                    </td>
                    <td colSpan={4} style={{ borderTop: '1px solid var(--wa-07)' }} />
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--wa-07)' }}>
                      {formatEuro(totalRecebido)}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: profitColor(lucroPct), borderTop: '1px solid var(--wa-07)' }}>
                      {totalLucroBruto >= 0 ? '+' : ''}{formatEuro(totalLucroBruto)}
                      <span style={{ display: 'block', fontSize: '0.6rem' }}>
                        {formatPct(lucroPct, { signed: true })}
                      </span>
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: profitColor(lucroPct), borderTop: '1px solid var(--wa-07)' }}>
                      {totalLucroLiq >= 0 ? '+' : ''}{formatEuro(totalLucroLiq)}
                      {totalImposto > 0 && (
                        <span style={{ display: 'block', fontSize: '0.58rem', color: 'var(--red)', fontWeight: 400 }}>
                          IRS −{formatEuro(totalImposto)}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Dividendos: calendário + yield on cost */}
      <DividendsSection holdings={allPositions} year={yearFilter ?? selectedYear} />

      {/* Nota de ajuda */}
      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>
        Clica em <strong style={{ color: 'var(--text)' }}>Preço venda</strong> ou <strong style={{ color: 'var(--text)' }}>Recebido</strong> para editar — o lucro actualiza automaticamente. O ícone <RotateCcw size={10} aria-hidden="true" style={{ verticalAlign: 'middle' }} /> repõe o cálculo automático (preço × qtd).
      </p>
    </div>
  )
}
