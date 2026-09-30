import { useState, useRef } from 'react'
import {
  Plus, Trash2, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, DollarSign,
  Lock, GripVertical, X,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  formatEuro, MONTHS_SHORT, calcDividendsYear,
  mkToNum, holdingQtyAtMk, holdingEarliestBuyMk,
} from '../../data/initialData.js'
import { holdingAdjustedStats } from '../../utils/calc/stockCalc.js'
import { EditableField } from '../ui/EditableField.jsx'
import { profitColor, profitSign, formatNative } from './utils.js'
import LotsPanel from './LotsPanel.jsx'
import SellPopover from './SellPopover.jsx'
import DivsModal from './DivsModal.jsx'

// ── Linha de holding ────────────────────────────────────────────
// Linha única de uma acção/ETF numa tabela de holdings. Usa snapshot
// do mês (`monthData[mk]`) se existir, senão o preço/qty live. Quando
// tem `lots`, a qty é sempre derivada dos lots (não da raiz). Suporta
// venda total (preenche `sellMk`) ou parcial (adiciona sell lot com
// qty negativa). O gasto aceita override manual por mês.
export default function HoldingRow({ h, color, onUpdate, onRemove, onSell, year, withDividends, mk, locked, dragProps, isDragOver, isDragging }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showDivs,      setShowDivs]      = useState(false) // modal
  const [showLots,      setShowLots]      = useState(false)
  const [sellMode,      setSellMode]      = useState(false)
  const [sellAnchor,    setSellAnchor]    = useState(null) // { top, right } viewport coords
  const sellBtnRef = useRef(null)

  const hasLots = (h.lots?.length || 0) > 0
  const { exchangeRates } = useApp()

  // Preço: snapshot histórico se disponível, senão live
  const monthSnap    = h.monthData?.[mk]
  const isHistorical = !!monthSnap

  // Câmbio: mês fechado usa a taxa congelada no snapshot (invariante dos
  // meses fechados — como os bancos); mês aberto usa a taxa live.
  const fxRate = (h.currency && h.currency !== 'EUR')
    ? (locked
        ? (monthSnap?.rateToEUR ?? exchangeRates?.[h.currency] ?? 1.0)
        : (exchangeRates?.[h.currency] ?? monthSnap?.rateToEUR ?? 1.0))
    : 1.0
  const displayPrice = isHistorical ? (monthSnap.price ?? h.price) : h.price

  // Qtd: se há lots, sempre calculada a partir dos lots (fonte de verdade).
  // snap.qty só é usado em holdings legacy que não têm lots.
  const displayQty   = hasLots
    ? holdingQtyAtMk(h, mk)
    : (isHistorical ? (monthSnap?.qty ?? h.qty ?? 0) : (h.qty || 0))
  // Gasto ajustado ao custo proporcional da posição restante + lucro realizado de sells parciais
  const { adjustedGasto: calcGasto, realizedProfit } = holdingAdjustedStats(h, mk)
  // Override por mês: encontra o override mais recente <= mk actual
  const gastoOverrideMk = (() => {
    const overrides = h.gastoOverrideByMk
    if (!overrides || !mk) return null
    const cur = mkToNum(mk)
    const entries = Object.entries(overrides)
      .filter(([m]) => mkToNum(m) <= cur)
      .sort((a, b) => mkToNum(b[0]) - mkToNum(a[0]))
    return entries.length > 0 ? entries[0][1] : null
  })()
  const displayGasto = gastoOverrideMk != null ? gastoOverrideMk : calcGasto
  // Quando há override manual, o lucro realizado dos sell lots é ignorado —
  // o override já representa o custo total da posição, sem ambiguidade.
  const effectiveRealized = gastoOverrideMk != null ? 0 : realizedProfit

  const value      = (displayQty || 0) * (displayPrice || 0) * fxRate
  const divs       = withDividends ? calcDividendsYear(h, year) : 0
  const profitVal  = value - displayGasto + divs + effectiveRealized
  const profitPct  = displayGasto > 0 ? profitVal / displayGasto : 0
  const pureProfit = value - displayGasto + effectiveRealized
  const PIcon      = profitPct >= 0 ? TrendingUp : TrendingDown

  function update(field, val) {
    if (locked) return  // mês fechado — sem edições
    if (isHistorical && (field === 'price' || field === 'qty')) {
      onUpdate({ ...h, monthData: { ...h.monthData, [mk]: { ...monthSnap, [field]: val } } })
    } else if (field === 'price') {
      // Edição manual do preço live conta como atualização de frescura
      onUpdate({ ...h, price: val, priceUpdatedAt: new Date().toISOString() })
    } else {
      onUpdate({ ...h, [field]: val })
    }
  }

  // Frescura do preço live: sem timestamp ou >7 dias → indicador.
  // Date.now() no render é deliberado — granularidade de dias, re-render
  // frequente; não vale a pena estado/efeito para isto.
  // eslint-disable-next-line react-hooks/purity
  const priceAgeDays = h.priceUpdatedAt ? (Date.now() - new Date(h.priceUpdatedAt).getTime()) / 86400000 : null
  const priceStale   = !isHistorical && !locked && !h.sellMk && (priceAgeDays == null || priceAgeDays > 7)

  function addLot(lot) {
    if (locked) return
    const newLots = [...(h.lots || []), lot]
    const newMonthData = { ...(h.monthData || {}) }
    if (lot.buyMk && !newMonthData[lot.buyMk]) {
      const qtyAtLotMk = newLots
        .filter(l => !l.buyMk || (l.buyMk && mkToNum(l.buyMk) <= mkToNum(lot.buyMk)))
        .reduce((s, l) => s + (l.qty || 0), 0)
      newMonthData[lot.buyMk] = { price: lot.price, qty: qtyAtLotMk }
    }
    onUpdate({ ...h, lots: newLots, monthData: newMonthData })
  }

  function removeLot(lotId) {
    if (locked) return
    onUpdate({ ...h, lots: (h.lots || []).filter(l => l.id !== lotId) })
  }

  function updateLot(lotId, changes) {
    if (locked) return
    onUpdate({ ...h, lots: (h.lots || []).map(l => l.id === lotId ? { ...l, ...changes } : l) })
  }

  function addDividend(div) {
    if (locked) return
    onUpdate({ ...h, dividends: [...(h.dividends || []), div] })
  }
  function removeDividend(divId) {
    if (locked) return
    onUpdate({ ...h, dividends: (h.dividends || []).filter(d => d.id !== divId) })
  }

  const c = { padding: '8px 6px', borderBottom: '1px solid var(--wa-03)' }

  const colSpanTotal = withDividends ? 12 : 11

  return (
    <>
      <tr style={{
          transition: 'background 0.1s, opacity 0.1s',
          background: isDragOver ? 'rgba(129,140,248,0.07)' : 'transparent',
          opacity: isDragging ? 0.35 : 1,
          borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
        }}
        onMouseEnter={e => { if (!isDragOver && !isDragging) e.currentTarget.style.background = 'var(--wa-015)' }}
        onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.background = 'transparent' }}
        {...(dragProps || {})}>

        {/* Drag handle */}
        <td style={{ ...c, paddingLeft: 6, paddingRight: 2, width: 18 }}>
          {dragProps && (
            <GripVertical size={12} style={{ color: 'var(--text-muted)', opacity: 0.4, cursor: 'grab', display: 'block' }} />
          )}
        </td>

        {/* Ticker + lots toggle */}
        <td style={{ ...c, paddingLeft: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <EditableField type="text" value={h.ticker} onSave={v => update('ticker', v.toUpperCase())} width={55} fontSize="0.78rem" fontWeight={700} color="var(--text)" locked={locked} />
            {/* Botão compras */}
            <button onClick={() => setShowLots(!showLots)} title="Compras / Lotes"
              style={{ background: showLots ? 'rgba(129,140,248,0.12)' : 'none', border: showLots ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent', borderRadius: 4, cursor: 'pointer', color: hasLots ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2, padding: '1px 4px', fontSize: '0.6rem', fontWeight: 600 }}>
              {hasLots ? h.lots.length : <Plus size={8} />}
              {showLots ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
            </button>
          </div>
        </td>

        {/* Data de compra */}
        <td style={{ ...c, textAlign: 'center' }}>
          {(() => {
            const bm = holdingEarliestBuyMk(h)
            if (!bm) return <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>—</span>
            const [y, m] = bm.split('-')
            return <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{MONTHS_SHORT[parseInt(m,10)-1]} {y}</span>
          })()}
        </td>

        <td style={c}><EditableField type="text" value={h.name} onSave={v => update('name', v)} width={120} fontSize="0.78rem" locked={locked} /></td>
        <td style={c}><EditableField type="text" value={h.platform} onSave={v => update('platform', v)} width={65} fontSize="0.78rem" locked={locked} /></td>

        {/* Qtd — read-only se tem lots (derivado), editável se legacy */}
        <td style={{ ...c, textAlign: 'right' }}>
          {hasLots ? (
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {displayQty.toFixed(4)}
            </span>
          ) : (
            <EditableField type="number" value={displayQty} onSave={v => update('qty', v)} formatter={v => v.toFixed(4)} width={65} fontSize="0.76rem" locked={locked} />
          )}
        </td>

        {/* Preço (editável mesmo em histórico) */}
        <td style={{ ...c, textAlign: 'right' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <EditableField type="number" value={displayPrice} onSave={v => update('price', v)} formatter={v => formatNative(v, h.currency)} width={70} fontSize="0.76rem" locked={locked} />
              {isHistorical && <span title="Preço registado no mês" style={{ fontSize: '0.55rem', color: 'var(--accent)', opacity: 0.7 }}>📅</span>}
              {priceStale && (
                <span title={priceAgeDays == null
                    ? 'Preço sem data de atualização — usa "Atualizar preços" no cabeçalho'
                    : `Preço atualizado há ${Math.floor(priceAgeDays)} dias`}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', flexShrink: 0, opacity: 0.8 }} />
              )}
            </div>
            <EditableField type="text" value={h.currency || 'EUR'} onSave={v => update('currency', v.toUpperCase().trim() || 'EUR')} width={36} fontSize="0.6rem" fontWeight={600} color="var(--text-muted)" locked={locked} />
          </div>
        </td>

        {/* Gasto — sempre editável; se tem lots usa gastoOverrideByMk ou calculado */}
        <td style={{ ...c, textAlign: 'right' }}>
          {hasLots ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <EditableField type="number" value={displayGasto} onSave={v => {
                  const updated = { ...(h.gastoOverrideByMk || {}), [mk]: v }
                  onUpdate({ ...h, gastoOverrideByMk: updated })
                }} formatter={v => formatEuro(v)} width={70} fontSize="0.76rem" locked={locked} />
                {gastoOverrideMk != null && !locked && (
                  <button onClick={() => {
                    const updated = { ...(h.gastoOverrideByMk || {}) }
                    delete updated[mk]
                    onUpdate({ ...h, gastoOverrideByMk: Object.keys(updated).length ? updated : undefined })
                  }} title="Repor valor calculado automaticamente para este mês"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', padding: 1, opacity: 0.7, lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                    <X size={8} />
                  </button>
                )}
              </div>
              {gastoOverrideMk != null && (
                <span style={{ fontSize: '0.55rem', color: 'var(--accent)', opacity: 0.7 }}>manual</span>
              )}
              {h.lots.some(l => (l.taxa || 0) > 0) && (
                <span style={{ fontSize: '0.63rem', color: '#fbbf24', opacity: 0.7 }}>
                  taxa: {formatEuro(h.lots.reduce((s, l) => s + (l.taxa || 0), 0))}
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <EditableField type="number" value={h.gasto} onSave={v => update('gasto', v)} formatter={v => formatEuro(v)} width={70} fontSize="0.76rem" locked={locked} />
              {(h.taxaGasto || 0) > 0 && (
                <span style={{ fontSize: '0.63rem', color: '#fbbf24', opacity: 0.7 }}>taxa: {formatEuro(h.taxaGasto)}</span>
              )}
            </div>
          )}
        </td>

        {/* Valor */}
        <td style={{ ...c, textAlign: 'right' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatEuro(value)}
          </span>
        </td>

        {/* Lucro */}
        <td style={{ ...c, textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            <PIcon size={10} style={{ color: profitColor(profitPct) }} />
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: profitColor(profitPct), fontVariantNumeric: 'tabular-nums' }}>
              {profitSign(profitVal)}{formatEuro(profitVal)}
            </span>
            <span style={{ fontSize: '0.68rem', color: profitColor(profitPct), opacity: 0.7 }}>
              ({profitSign(profitPct)}{(profitPct * 100).toFixed(1)}%)
            </span>
          </div>
          {withDividends && divs > 0 && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 1 }}>
              <span title="Valorização">Val: {profitSign(pureProfit)}{formatEuro(pureProfit)}</span>
              <span title="Dividendos" style={{ color: '#fbbf24' }}>Div: +{formatEuro(divs)}</span>
            </div>
          )}
        </td>

        {/* Dividendos toggle (abre modal) */}
        {withDividends && (
          <td style={{ ...c, textAlign: 'center' }}>
            <button onClick={() => setShowDivs(!showDivs)}
              style={{ background: showDivs ? 'rgba(251,191,36,0.1)' : 'none', border: showDivs ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent', borderRadius: 4, cursor: 'pointer', color: divs > 0 ? '#fbbf24' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2, padding: '2px 4px', fontSize: '0.68rem' }}
              title="Abrir dividendos">
              <DollarSign size={11} />
              {divs > 0 && <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(divs)}</span>}
            </button>
          </td>
        )}

        {/* Eliminar / Vender — oculto se mês fechado */}
        <td style={{ ...c, textAlign: 'center', width: 30 }}>
          {locked ? (
            <Lock size={9} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
          ) : sellMode ? (
            <SellPopover
              displayPrice={displayPrice} displayQty={displayQty} displayGasto={displayGasto}
              anchor={sellAnchor}
              mk={mk}
              minMk={holdingEarliestBuyMk(h)}
              onConfirm={(sale) => { onSell(h.id, sale); setSellMode(false); setConfirmDelete(false) }}
              onClose={() => setSellMode(false)} />
          ) : confirmDelete ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <button ref={sellBtnRef} onClick={() => {
                  const rect = sellBtnRef.current?.getBoundingClientRect()
                  if (rect) setSellAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                  setSellMode(true)
                }}
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 4, padding: '2px 7px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Vender
              </button>
              <button onClick={() => onRemove(h.id)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Apagar
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ background: 'none', color: 'var(--text-muted)', border: 'none', fontSize: '0.68rem', cursor: 'pointer', padding: '1px 3px' }}>
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <Trash2 size={11} />
            </button>
          )}
        </td>
      </tr>

      {/* ── Compras / Lots expandido ── */}
      {showLots && (
        <LotsPanel h={h} mk={mk} locked={locked} colSpan={colSpanTotal}
          onAddLot={addLot} onRemoveLot={removeLot} onUpdateLot={updateLot} />
      )}

      {/* ── Dividendos modal ── */}
      {withDividends && showDivs && (
        <DivsModal h={h} year={year} locked={locked}
          onClose={() => setShowDivs(false)}
          onAdd={addDividend} onRemove={removeDividend} />
      )}
    </>
  )
}
