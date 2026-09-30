import { useState, useRef, useEffect } from 'react'
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Lock, Unlock, X, RefreshCw,
} from 'lucide-react'
import Button from '../ui/Button.jsx'
import { useApp } from '../../context/AppContext.jsx'
import {
  getMK, MONTHS, MONTHS_SHORT, holdingQtyAtMk,
} from '../../data/initialData.js'
import { currentYear } from './constants.js'
import { buildLockMonthPatch, buildUnlockMonthPatch } from '../../utils/lockMonth.js'

// ── Cabeçalho de mês para Ações & ETFs ──────────────────────────
// Navegação de ano + 12 pills de mês com estados (activo, fechado,
// com/sem dados). Botão direito num mês com dados abre menu para
// apagar. "Novo Mês" busca preços Yahoo para todos os holdings e
// avisa se alguns falharam (usa preço anterior como fallback).
// Guardas: só avança ano se Dez do actual estiver aberto; só recua
// ano se o anterior tiver algum dado (evita prender o user no começo
// de um ano novo).
export default function StocksMonthHeader({ data, saveData, stocks }) {
  const { exchangeRates } = useApp()
  const year  = data?.currentYear  ?? currentYear
  const month = data?.currentMonth ?? new Date().getMonth()
  const mk    = getMK(year, month)

  const [fetching, setFetching] = useState(false)
  const fetchingRef = useRef(null)
  const [ctxMenu, setCtxMenu]   = useState(null) // { x, y, monthIdx }
  const [apiWarning, setApiWarning] = useState(null) // { n, total } quando alguns preços falharam

  function setYM(y, m) { saveData({ currentYear: y, currentMonth: m }) }

  // Fechar context menu ao clicar fora
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  // ── Dados derivados ──────────────────────────────────────────
  const allH = [...(stocks.acoes?.holdings || []), ...(stocks.etfs?.holdings || [])]

  // Meses com dados (algum holding tem monthData para esse mês OU foi marcado em stocks.months)
  const monthsWithData = new Set()
  for (const key of Object.keys(stocks.months || {})) {
    const [ky, km] = key.split('-').map(Number)
    if (ky === year) monthsWithData.add(km)
  }
  for (const h of allH) {
    for (const key of Object.keys(h.monthData || {})) {
      const [ky, km] = key.split('-').map(Number)
      if (ky === year) monthsWithData.add(km)
    }
  }
  const currentHasData = monthsWithData.has(month)

  // Lock state por mês
  const lockedMonths = stocks.years?.[year]?.lockedMonths || []
  const isLocked     = lockedMonths.includes(month)

  // Guardas de navegação de ano:
  // → ano seguinte só permitido se Dezembro do ano actual está aberto
  const canGoNextYear = monthsWithData.has(11) // Dez do ano actual

  // → ano anterior: verificar se o ano anterior tem algum dado
  //   (não se pode usar "Janeiro do actual" porque ao chegar a um novo ano
  //    esse Janeiro ainda não está aberto e ficaria preso sem conseguir voltar)
  const prevYearNum = year - 1
  let prevYearHasData = Object.keys(stocks.months || {}).some(k => k.startsWith(`${prevYearNum}-`))
  if (!prevYearHasData) {
    prevYearHasData = allH.some(h =>
      Object.keys(h.monthData || {}).some(k => k.startsWith(`${prevYearNum}-`))
    )
  }
  const canGoPrevYear = prevYearHasData

  // ── Novo Mês: busca preços do Yahoo e regista snapshot ────────
  async function createNewMonth() {
    if (fetching) return
    setFetching(true)
    setApiWarning(null)
    fetchingRef.current = mk

    async function fetchPrice(ticker, targetYear, targetMonth) {
      try {
        const result = await window.api?.fetchStockHistory(ticker)
        if (!result?.points?.length) return null
        const match = result.points.find(p => p.year === targetYear && p.month === targetMonth)
          ?? result.points.filter(p =>
              (p.year === targetYear && p.month <= targetMonth) || p.year < targetYear
            ).at(-1)
        return match?.price ?? null
      } catch { return null }
    }

    let fallbacks = 0
    const mapH = async h => {
      if (h.monthData?.[mk]) return h  // já tem snapshot
      const price = await fetchPrice(h.ticker, year, month)
      const qty   = holdingQtyAtMk(h, mk)
      if (price === null) fallbacks++
      // Congela também o câmbio do momento (invariante dos meses fechados)
      const rateToEUR = (h.currency && h.currency !== 'EUR')
        ? (exchangeRates?.[h.currency] ?? 1.0) : undefined
      return { ...h, monthData: { ...(h.monthData || {}), [mk]: { price: price ?? h.price, qty, ...(rateToEUR != null ? { rateToEUR } : {}) } } }
    }

    const [newAcoesH, newEtfsH] = await Promise.all([
      Promise.all((stocks.acoes?.holdings || []).map(mapH)),
      Promise.all((stocks.etfs?.holdings  || []).map(mapH)),
    ])

    const totalH = (stocks.acoes?.holdings || []).length + (stocks.etfs?.holdings || []).length
    saveData({
      stocks: {
        ...stocks,
        months: { ...(stocks.months || {}), [mk]: true },
        acoes: { ...(stocks.acoes || {}), holdings: newAcoesH },
        etfs:  { ...(stocks.etfs  || {}), holdings: newEtfsH  },
      },
    })
    setFetching(false)
    fetchingRef.current = null
    if (fallbacks > 0) setApiWarning({ n: fallbacks, total: totalH })
  }

  // ── Atualizar preços live ─────────────────────────────────────
  // Busca o preço actual de todos os holdings activos e regista
  // `priceUpdatedAt` — antes disto, h.price só mudava na criação ou à mão.
  async function refreshLivePrices() {
    if (fetching) return
    setFetching(true)
    setApiWarning(null)
    let fallbacks = 0
    const nowIso = new Date().toISOString()
    const mapLive = async h => {
      if (h.sellMk) return h // posição vendida — preço live é irrelevante
      const res = await window.api?.fetchStockPrice(h.ticker).catch(() => null)
      if (!res?.price) { fallbacks++; return h }
      return { ...h, price: res.price, priceUpdatedAt: nowIso }
    }
    const [newAcoesH, newEtfsH] = await Promise.all([
      Promise.all((stocks.acoes?.holdings || []).map(mapLive)),
      Promise.all((stocks.etfs?.holdings  || []).map(mapLive)),
    ])
    saveData({
      stocks: {
        ...stocks,
        acoes: { ...(stocks.acoes || {}), holdings: newAcoesH },
        etfs:  { ...(stocks.etfs  || {}), holdings: newEtfsH  },
      },
    })
    setFetching(false)
    const totalActive = allH.filter(h => !h.sellMk).length
    if (fallbacks > 0) setApiWarning({ n: fallbacks, total: totalActive })
  }

  // ── Fechar / Desbloquear Mês (unificado: bancos + ações + cripto) ──
  function toggleLock() {
    const patch = isLocked
      ? buildUnlockMonthPatch(data, year, month)
      : buildLockMonthPatch(data, year, month)
    if (Object.keys(patch).length) saveData(patch)
  }

  // ── Apagar Mês ────────────────────────────────────────────────
  function deleteMonth(monthIdx) {
    const targetMK = getMK(year, monthIdx)
    const removeSnap = h => {
      if (!h.monthData?.[targetMK]) return h
      const md = { ...h.monthData }
      delete md[targetMK]
      return { ...h, monthData: md }
    }
    const newMonths = { ...(stocks.months || {}) }
    delete newMonths[targetMK]
    const prevYearsData = stocks.years || {}
    const prevYear      = prevYearsData[year] || { lockedMonths: [] }
    const newLocked     = (prevYear.lockedMonths || []).filter(m => m !== monthIdx)
    saveData({
      stocks: {
        ...stocks,
        months: newMonths,
        years: { ...prevYearsData, [year]: { ...prevYear, lockedMonths: newLocked } },
        acoes: { ...(stocks.acoes || {}), holdings: (stocks.acoes?.holdings || []).map(removeSnap) },
        etfs:  { ...(stocks.etfs  || {}), holdings: (stocks.etfs?.holdings  || []).map(removeSnap) },
      },
    })
    setCtxMenu(null)
  }

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* Ano + meses */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => canGoPrevYear && setYM(year - 1, 11)} disabled={!canGoPrevYear}
              title={canGoPrevYear ? '' : `Sem dados em ${prevYearNum}`}
              style={{ background: 'none', border: 'none', cursor: canGoPrevYear ? 'pointer' : 'default', color: 'var(--text-muted)', opacity: canGoPrevYear ? 1 : 0.3, display: 'flex', padding: 2 }}
              onMouseEnter={e => { if (canGoPrevYear) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', minWidth: 36, textAlign: 'center' }}>{year}</span>
            <button onClick={() => canGoNextYear && setYM(year + 1, 0)} disabled={!canGoNextYear}
              title={canGoNextYear ? '' : 'Abre Dezembro deste ano antes de avançar'}
              style={{ background: 'none', border: 'none', cursor: canGoNextYear ? 'pointer' : 'default', color: 'var(--text-muted)', opacity: canGoNextYear ? 1 : 0.3, display: 'flex', padding: 2 }}
              onMouseEnter={e => { if (canGoNextYear) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <ChevronRight size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {MONTHS_SHORT.map((m, i) => {
              const hasData   = monthsWithData.has(i)
              const isActive  = i === month
              const isMLocked = lockedMonths.includes(i)
              return (
                <button key={m}
                  onClick={() => setYM(year, i)}
                  onContextMenu={e => { e.preventDefault(); if (hasData) setCtxMenu({ x: e.clientX, y: e.clientY, monthIdx: i }) }}
                  title={hasData ? (isMLocked ? `${m} — fechado` : `${m} — botão direito para apagar`) : `${m} — sem dados`}
                  style={{
                    padding: '4px 10px', borderRadius: 20, position: 'relative',
                    border: `1px solid ${isActive ? (isMLocked ? 'rgba(251,191,36,0.5)' : 'rgba(245,158,11,0.5)') : 'var(--border)'}`,
                    background: isActive ? (isMLocked ? 'rgba(251,191,36,0.2)' : 'rgba(245,158,11,0.18)') : 'transparent',
                    color: isActive ? '#f59e0b' : hasData ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer', opacity: hasData || isActive ? 1 : 0.35,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--wa-04)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  {m}
                  {isMLocked && <span style={{ position: 'absolute', top: -2, right: -2, width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', border: '1px solid var(--bg-elevated)' }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Acções */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLocked ? (
            <Button size="sm" icon={<Unlock size={12} />} onClick={toggleLock}
              title={`Reabre ${MONTHS[month]} em toda a app — bancos, ações e cripto`}
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 20, color: '#f59e0b' }}>
              Abrir mês
            </Button>
          ) : (
            <Button size="sm" icon={<Lock size={12} />} onClick={toggleLock}
              disabled={!currentHasData}
              title={!currentHasData ? 'Abre o mês antes de o fechar' : `Fecha ${MONTHS[month]} em toda a app — bancos, ações e cripto`}
              style={{ borderRadius: 20 }}>
              Fechar mês
            </Button>
          )}
          {!currentHasData && !isLocked && (
            <Button size="sm" icon={<Plus size={13} />} loading={fetching}
              onClick={createNewMonth} disabled={fetching}
              title={`Abrir ${MONTHS[month]} — busca preços e cria snapshot`}
              style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 20, color: 'var(--accent)' }}>
              {fetching ? 'A buscar preços…' : 'Novo Mês'}
            </Button>
          )}
          {allH.some(h => !h.sellMk) && (
            <Button size="sm" icon={<RefreshCw size={12} />} loading={fetching}
              onClick={refreshLivePrices} disabled={fetching}
              title="Atualizar o preço live de todas as posições activas (Alpha Vantage — tier gratuito: ~25 pedidos/dia)"
              style={{ borderRadius: 20, color: 'var(--text-muted)' }} variant="ghost">
              Atualizar preços
            </Button>
          )}

        {/* Aviso de fallback de preços */}
        {apiWarning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, fontSize: '0.72rem', color: '#fbbf24' }}>
            <span>⚠</span>
            <span>
              {apiWarning.n === apiWarning.total
                ? 'Sem acesso à API — todos os preços usam o valor anterior.'
                : `${apiWarning.n} de ${apiWarning.total} ativo${apiWarning.n > 1 ? 's' : ''} sem preço da API — usou valor anterior.`
              }{' '}Verifica a ligação ou edita manualmente.
            </span>
            <button onClick={() => setApiWarning(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fbbf24', opacity: 0.6, display: 'flex', padding: 1, marginLeft: 4 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
              <X size={11} />
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: 4, zIndex: 9999, minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <button onClick={() => deleteMonth(ctxMenu.monthIdx)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 12px', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <Trash2 size={13} /> Apagar {MONTHS[ctxMenu.monthIdx]}
          </button>
        </div>
      )}
    </div>
  )
}
