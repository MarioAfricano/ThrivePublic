import { useApp } from '../context/AppContext.jsx'
import {
  formatEuro, getMK, MONTHS,
  calcBolsosTotal, calcAllDividendsYear,
  mkToNum, holdingActiveInMk, holdingQtyAtMk, holdingGastoAtMk,
} from '../data/initialData.js'
import { Plus, TrendingUp, Wallet } from 'lucide-react'
import { generateId as uid } from '../utils/id.js'
import {
  bolsoInvestidoAtMk, holdingAdjustedStats, effectiveGasto,
} from '../utils/calc/stockCalc.js'
import { EditableField } from '../components/ui/EditableField.jsx'
import { currentYear, TAX_RATE } from '../components/acoes/constants.js'
import { profitColor, profitSign } from '../components/acoes/utils.js'
import DonutChart from '../components/acoes/DonutChart.jsx'
import StocksMonthHeader from '../components/acoes/StocksMonthHeader.jsx'
import MigrationBanner from '../components/acoes/MigrationBanner.jsx'
import HoldingsSection from '../components/acoes/HoldingsSection.jsx'
import BolsoCard from '../components/acoes/BolsoCard.jsx'

// ══════════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL — AÇÕES & ETFs
// ══════════════════════════════════════════════════════════════════
export default function Acoes() {
  const { data, saveData, exchangeRates } = useApp()

  const year  = data?.currentYear  ?? currentYear
  const month = data?.currentMonth ?? new Date().getMonth()
  const mk    = getMK(year, month)

  // ── Dados ────────────────────────────────────────────────────
  const stocks        = data?.stocks || {}
  const acoesH        = stocks.acoes?.holdings   || []
  const etfsH         = stocks.etfs?.holdings    || []
  const bolsos        = stocks.bolsos            || []
  const unclassified  = stocks._unclassified     || []
  const freeFunds     = stocks.freeFunds?.length
    ? stocks.freeFunds
    : [{ id: 'xtb', name: 'XTB', amount: 0 }, { id: 'degiro', name: 'Degiro', amount: 0 }]

  // Mês actual bloqueado?
  const lockedMonths  = stocks.years?.[year]?.lockedMonths || []
  const isLocked      = lockedMonths.includes(month)

  // ── Totais (usam preços do mês seleccionado quando disponíveis, convertidos para EUR) ─
  function holdingValEUR(h) {
    const snap  = mk ? h.monthData?.[mk] : null
    const price = snap ? (snap.price ?? h.price) : h.price
    const qty   = h.lots?.length ? holdingQtyAtMk(h, mk) : (snap ? (snap.qty ?? holdingQtyAtMk(h, mk)) : holdingQtyAtMk(h, mk))
    const fx    = (h.currency && h.currency !== 'EUR') ? (exchangeRates?.[h.currency] ?? 1.0) : 1.0
    if (!holdingActiveInMk(h, mk)) return 0
    return (qty || 0) * (price || 0) * fx
  }
  const acoesVal  = acoesH.reduce((s, h) => s + holdingValEUR(h), 0)
  const etfsVal   = etfsH.reduce((s, h) => s + holdingValEUR(h), 0)
  const bolsosVal = calcBolsosTotal(bolsos, mk)
  const totalVal  = acoesVal + etfsVal + bolsosVal

  // Só holdings activas no mês — usa holdingAdjustedStats para consistência com as linhas da tabela
  // (holdingGastoAtMk sobreconta o gasto em holdings com vendas parciais via sell lots)
  const acoesActiveH         = acoesH.filter(h => holdingActiveInMk(h, mk))
  const etfsActiveH          = etfsH.filter(h => holdingActiveInMk(h, mk))
  const acoesGasto           = acoesActiveH.reduce((s, h) => s + effectiveGasto(h, mk), 0)
  const etfsGasto            = etfsActiveH.reduce((s, h) => s + effectiveGasto(h, mk), 0)
  const bolsosGasto          = bolsos.reduce((s, b) => s + bolsoInvestidoAtMk(b, mk), 0)
  // Lucro realizado de vendas parciais — ignorado se holding tem gasto manual (override)
  const acoesPartialRealized = acoesActiveH.reduce((s, h) => {
    const hasOverride = effectiveGasto(h, mk) !== holdingAdjustedStats(h, mk).adjustedGasto
    return s + (hasOverride ? 0 : holdingAdjustedStats(h, mk).realizedProfit)
  }, 0)
  const etfsPartialRealized  = etfsActiveH.reduce((s, h) => {
    const hasOverride = effectiveGasto(h, mk) !== holdingAdjustedStats(h, mk).adjustedGasto
    return s + (hasOverride ? 0 : holdingAdjustedStats(h, mk).realizedProfit)
  }, 0)

  // Lucro realizado das vendas feitas até este mês
  function calcRealizedProfit(holdings) {
    return holdings
      .filter(h => h.sellMk && mkToNum(h.sellMk) <= mkToNum(mk))
      .reduce((s, h) => {
        const sellLotsTotal = (h.lots || []).filter(l => l.isSell).reduce((ls, l) => ls + (l.sellTotal ?? 0), 0)
        const finalSale = h.sellTotal != null ? h.sellTotal : (h.sellPrice ?? 0) * (h.sellQty ?? holdingQtyAtMk(h, h.sellMk))
        const recebido = sellLotsTotal + finalSale
        return s + recebido - holdingGastoAtMk(h, null)
      }, 0)
  }
  const acoesRealized = calcRealizedProfit(acoesH)
  const etfsRealized  = calcRealizedProfit(etfsH)

  const acoesDivs = calcAllDividendsYear(acoesH, year)
  const taxDivs   = acoesDivs * TAX_RATE

  // ── Guardar dados ────────────────────────────────────────────
  function updateBolso(updated) {
    saveData({ stocks: { ...stocks, bolsos: bolsos.map(b => b.id === updated.id ? updated : b) } })
  }
  function removeBolso(id) {
    saveData({ stocks: { ...stocks, bolsos: bolsos.filter(b => b.id !== id) } })
  }
  function saveFreeFund(id, amount) {
    const updated = freeFunds.map(f => f.id === id ? { ...f, amount } : f)
    saveData({ stocks: { ...stocks, freeFunds: updated } })
  }

  function addBolso() {
    const newB = { id: uid(), name: 'Novo bolso', platform: '—', valorAtual: 0, valorInvestido: 0, entregas: [], monthData: {} }
    saveData({ stocks: { ...stocks, bolsos: [...bolsos, newB] } })
  }

  // ── Dados donut ──────────────────────────────────────────────
  const donutSlices = [
    { label: 'Ações', value: acoesVal, color: '#4ade80' },
    { label: 'ETFs',  value: etfsVal + bolsosVal, color: '#22d3ee' },
  ]

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Título ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#4ade80,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>Ações & ETFs</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {MONTHS[month]} {year}
            {isLocked && <span style={{ marginLeft: 8, fontSize: '0.72rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600 }}>Mês fechado</span>}
          </p>
        </div>
      </div>

      {/* ── Navegação de mês ─────────────────────────────────── */}
      <StocksMonthHeader data={data} saveData={saveData} stocks={stocks} />

      {/* ── Banner de migração (aparece só se houver holdings legado) ── */}
      <MigrationBanner unclassified={unclassified} stocks={stocks} saveData={saveData} />

      {/* ── Resumo: cartões + donut ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 180 }}>
          <DonutChart slices={donutSlices} size={130} />
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            {donutSlices.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{totalVal > 0 ? ((s.value / totalVal) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cartões resumo */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {/* Total */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Valor Total</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8 }}>{formatEuro(totalVal)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />Ações
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(acoesVal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', flexShrink: 0 }} />ETFs
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(etfsVal + bolsosVal)}</span>
              </div>
            </div>
          </div>
          {/* Investido */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Total Investido</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8 }}>{formatEuro(acoesGasto + etfsGasto + bolsosGasto)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />Ações
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(acoesGasto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', flexShrink: 0 }} />ETFs
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(etfsGasto + bolsosGasto)}</span>
              </div>
            </div>
          </div>
          {/* Lucro */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Lucro Total</div>
            {(() => {
              const unrealized   = totalVal - (acoesGasto + etfsGasto + bolsosGasto)
              const realized     = acoesRealized + etfsRealized + acoesPartialRealized + etfsPartialRealized
              const totalProfit  = unrealized + realized + acoesDivs
              const totalInvested = acoesGasto + etfsGasto + bolsosGasto
              const totalPct     = totalInvested > 0 ? totalProfit / totalInvested : 0
              return (<>
                <div style={{ fontSize: '1.32rem', fontWeight: 800, color: profitColor(totalPct), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {profitSign(totalProfit)}{formatEuro(totalProfit)}
                </div>
                {realized !== 0 && (
                  <div style={{ fontSize: '0.73rem', color: profitColor(realized), marginTop: 4, opacity: 0.8 }}>
                    Realizado: {profitSign(realized)}{formatEuro(realized)}
                  </div>
                )}
              </>)
            })()}
          </div>
          {/* Dividendos */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Dividendos {year}</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: acoesDivs > 0 ? '#fbbf24' : 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {formatEuro(acoesDivs)}
            </div>
            {acoesDivs > 0 && <div style={{ fontSize: '0.73rem', color: '#fbbf24', marginTop: 4, opacity: 0.8 }}>IRS est.: {formatEuro(taxDivs)}</div>}
          </div>
        </div>
      </div>

      {/* ── Fundos livres ───────────────────────────────────── */}
      {freeFunds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>
            Fundos livres
          </span>
          {freeFunds.map(f => (
            <div key={f.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>{f.name}</span>
              <EditableField
                type="number"
                value={f.amount}
                onSave={v => saveFreeFund(f.id, v)}
                formatter={v => formatEuro(v)}
                width={75}
                fontSize="0.82rem"
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Secção Ações ────────────────────────────────────── */}
      <HoldingsSection
        title="Ações" holdings={acoesH}
        onSave={(newH, sortByOverride) => {
          const clean = newH.map(({ _color, ...rest }) => rest)
          const acoes = { ...(stocks.acoes || {}), holdings: clean }
          if (sortByOverride !== undefined) acoes.sortBy = sortByOverride
          saveData({ stocks: { ...stocks, acoes } })
        }}
        year={year} withDividends={true} accentColor="#4ade80" mk={mk} locked={isLocked}
        sortByPref={stocks.acoes?.sortBy}
      />

      {/* ── Secção ETFs ─────────────────────────────────────── */}
      <HoldingsSection
        title="ETFs" holdings={etfsH}
        onSave={(newH, sortByOverride) => {
          const clean = newH.map(({ _color, ...rest }) => rest)
          const etfs = { ...(stocks.etfs || {}), holdings: clean }
          if (sortByOverride !== undefined) etfs.sortBy = sortByOverride
          saveData({ stocks: { ...stocks, etfs } })
        }}
        year={year} withDividends={false} accentColor="#22d3ee" mk={mk} locked={isLocked}
        sortByPref={stocks.etfs?.sortBy}
      />

      {/* ── Bolsos ──────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={14} style={{ color: '#22d3ee' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>Bolsos</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>({bolsos.length})</span>
            {bolsosVal > 0 && (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                — {formatEuro(bolsosVal)}
              </span>
            )}
          </div>
          <button onClick={addBolso}
            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--accent-dim)', color: 'var(--accent)', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={11} /> Novo bolso
          </button>
        </div>

        {bolsos.length === 0 ? (
          <div style={{ background: 'var(--bg-elevated)', border: '1px dashed rgba(34,211,238,0.25)', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sem bolsos · clica em "Novo bolso" para adicionar</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {bolsos.map(b => (
              <BolsoCard key={b.id} bolso={b} onUpdate={updateBolso} onRemove={removeBolso} mk={mk} locked={isLocked} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
