import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  formatEuro, calcAllDividendsYear, mkToNum,
  holdingActiveInMk, holdingQtyAtMk, holdingEarliestBuyMk,
} from '../../data/initialData.js'
import { holdingAdjustedStats, effectiveGasto } from '../../utils/calc/stockCalc.js'
import { generateId as uid } from '../../utils/id.js'
import { HOLDING_COLORS } from './constants.js'
import { profitColor, profitSign } from './utils.js'
import HoldingRow from './HoldingRow.jsx'
import AddHoldingForm from './AddHoldingForm.jsx'

// ── Secção de holdings (reutilizada para Ações e ETFs) ──────────
// Envolve a lista em card com header (totais + Adicionar), tabela
// ordenável (com drag-to-reorder que fixa `custom`), auto-merge ao
// adicionar se (ticker, platform) já existe, e decide entre venda
// total (`sellMk`) ou parcial (sell lot) em função da qty vendida.
export default function HoldingsSection({ title, holdings, onSave, year, withDividends, accentColor, mk, locked, sortByPref, onSortSave }) {
  const [adding, setAdding] = useState(false)
  const { exchangeRates } = useApp()
  const [sortBy, setSortBy] = useState(sortByPref || 'value')
  const [sortDir, setSortDir] = useState(-1)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  // Helper: valor de um holding para o mês seleccionado (convertido para EUR)
  function displayVal(h) {
    const snap  = mk ? h.monthData?.[mk] : null
    const price = snap ? (snap.price ?? h.price) : h.price
    // Se há lots, usá-los sempre para qty (são a fonte de verdade); snap.qty só para holdings legacy sem lots
    const qty   = h.lots?.length
      ? holdingQtyAtMk(h, mk)
      : (snap ? (snap.qty ?? holdingQtyAtMk(h, mk)) : holdingQtyAtMk(h, mk))
    const fx = (h.currency && h.currency !== 'EUR') ? (exchangeRates?.[h.currency] ?? 1.0) : 1.0
    return (qty || 0) * (price || 0) * fx
  }

  // Só mostrar holdings activos no mês seleccionado
  const colored = holdings.map((h, i) => ({ ...h, _color: HOLDING_COLORS[i % HOLDING_COLORS.length] }))
  const active  = colored.filter(h => holdingActiveInMk(h, mk))

  // 'custom' = ordem manual guardada no data store (ativada pelo drag)
  const sorted = sortBy === 'custom'
    ? [...active]
    : [...active].sort((a, b) => {
        if (sortBy === 'ticker') return sortDir * a.ticker.localeCompare(b.ticker)
        if (sortBy === 'profit') {
          const ga = effectiveGasto(a, mk), gb = effectiveGasto(b, mk)
          const pa = ga > 0 ? (displayVal(a) - ga) / ga : 0
          const pb = gb > 0 ? (displayVal(b) - gb) / gb : 0
          return sortDir * (pa - pb)
        }
        if (sortBy === 'gasto') return sortDir * (effectiveGasto(a, mk) - effectiveGasto(b, mk))
        if (sortBy === 'value') return sortDir * (displayVal(a) - displayVal(b))
        if (sortBy === 'date') return sortDir * (mkToNum(holdingEarliestBuyMk(a) || '0') - mkToNum(holdingEarliestBuyMk(b) || '0'))
        return sortDir * ((a[sortBy] ?? 0) - (b[sortBy] ?? 0))
      })

  const displayRows = sorted

  function applyDragReorder(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const arr = [...sorted]
    const [item] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, item)
    const activeIds = arr.map(h => h.id)
    const inactive = holdings.filter(h => !activeIds.includes(h.id))
    const reordered = activeIds.map(id => holdings.find(h => h.id === id))
    onSave([...reordered, ...inactive])
    setSortBy('custom')
    onSortSave?.('custom')
  }

  const totalVal            = active.reduce((s, h) => s + displayVal(h), 0)
  const totalGasto          = active.reduce((s, h) => s + effectiveGasto(h, mk), 0)
  const totalRealizedProfit = active.reduce((s, h) => {
    const override = effectiveGasto(h, mk) !== holdingAdjustedStats(h, mk).adjustedGasto
    return s + (override ? 0 : holdingAdjustedStats(h, mk).realizedProfit)
  }, 0)
  const totalDivs           = withDividends ? calcAllDividendsYear(active, year) : 0
  const totalProfit = totalVal - totalGasto + totalDivs + totalRealizedProfit
  const totalPct   = totalGasto > 0 ? totalProfit / totalGasto : 0

  function addHolding(h) {
    // Auto-merge: se já existe um holding com o mesmo ticker E mesma plataforma, junta os lots
    const normPlat = p => (p || '—').trim().toLowerCase()
    const existing = holdings.find(
      x => x.ticker === h.ticker && normPlat(x.platform) === normPlat(h.platform) && !x.sellMk
    )
    if (existing) {
      const mergedLots = [...(existing.lots || []), ...(h.lots || [])]

      // Merge monthData: para meses onde ambos têm snapshot, remove o qty fixo
      // para que calcHoldingValue use holdingQtyAtMk (que soma os lots corretamente)
      const mergedMonthData = { ...(existing.monthData || {}) }
      for (const [key, val] of Object.entries(h.monthData || {})) {
        if (mergedMonthData[key]) {
          // Mês em colisão: mantém o preço mais recente mas sem qty fixo
          const { qty: _qty, ...valWithoutQty } = val
          const { qty: _eqty, ...existWithoutQty } = mergedMonthData[key]
          mergedMonthData[key] = { ...existWithoutQty, ...valWithoutQty }
        } else {
          // Remove qty também aqui para consistência: deixar sempre os lots calcular
          const { qty: _qty, ...valWithoutQty } = val
          mergedMonthData[key] = valWithoutQty
        }
      }

      const updated = {
        ...existing,
        lots:      mergedLots,
        price:     h.price ?? existing.price,   // actualiza para o preço mais recente
        monthData: mergedMonthData,
      }
      onSave(holdings.map(x => x.id === existing.id ? updated : x))
    } else {
      onSave([...holdings, h])
    }
    setAdding(false)
  }
  function updateHolding(updated) { onSave(holdings.map(h => h.id === updated.id ? { ...updated } : h)) }
  function removeHolding(id) { onSave(holdings.filter(h => h.id !== id)) }
  // "Vender": parcial → sell lot com qty negativa; total → sellMk no holding
  // `sellMk` vem do popover: por omissao e o mes activo, mas pode ser um
  // mes passado (vendi em agosto, estou em setembro). Tudo o que depende
  // da data da venda — qty disponivel, lote parcial, sellMk — usa `saleMk`,
  // nunca o mes activo, senao uma venda passada era registada no mes errado.
  function sellHolding(id, { sellPrice, sellQty, sellTotal, sellMk } = {}) {
    const saleMk = sellMk || mk
    onSave(holdings.map(h => {
      if (h.id !== id) return h
      const totalQty  = holdingQtyAtMk(h, saleMk)
      const isPartial = sellQty != null && sellQty < totalQty - 0.00001
      if (isPartial) {
        const received = sellTotal ?? (sellPrice ?? 0) * sellQty
        const sellLot  = {
          id: uid(), buyMk: saleMk, qty: -sellQty, isSell: true, gasto: 0,
          sellPrice: sellPrice ?? 0, sellTotal: received,
        }
        return { ...h, lots: [...(h.lots || []), sellLot] }
      }
      // Venda total — comportamento original
      return {
        ...h,
        sellMk: saleMk,
        ...(sellPrice != null ? { sellPrice } : {}),
        ...(sellQty   != null ? { sellQty   } : {}),
        ...(sellTotal != null ? { sellTotal } : {}),
      }
    }))
  }
  function toggleSort(col) {
    if (sortBy === col) { setSortDir(d => d * -1) }
    else { setSortBy(col); setSortDir(-1); onSortSave?.(col) }
  }

  const th = { padding: '6px 6px', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--wa-06)', textAlign: 'left', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: accentColor }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>({active.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalVal)}</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: profitColor(totalPct), fontVariantNumeric: 'tabular-nums' }}>
            {profitSign(totalProfit)}{formatEuro(totalProfit)} ({profitSign(totalPct)}{(totalPct * 100).toFixed(1)}%)
          </span>
          {locked
            ? <span style={{ fontSize: '0.6rem', padding: '3px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600 }}>Mês fechado</span>
            : <button onClick={() => setAdding(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--accent-dim)', color: 'var(--accent)', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={11} /> Adicionar
              </button>
          }
        </div>
      </div>

      {adding && (
        <div style={{ padding: '0 14px 8px' }}>
          <AddHoldingForm onAdd={addHolding} onCancel={() => setAdding(false)} withDividends={withDividends} defaultMk={mk} existingHoldings={holdings} />
        </div>
      )}

      {active.length === 0 && !adding ? (
        <div style={{ padding: '24px 14px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Sem posições activas neste mês
          </p>
        </div>
      ) : active.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: withDividends ? 820 : 740 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 18, padding: '6px 2px', cursor: 'default' }} />
                <th style={{ ...th, paddingLeft: 6 }} onClick={() => toggleSort('ticker')}>Ticker</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => toggleSort('date')} title="Ordenar por data de compra">Data{sortBy === 'date' ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}</th>
                <th style={th}>Nome</th>
                <th style={th}>Plataforma</th>
                <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('qty')}>Qtd</th>
                <th style={{ ...th, textAlign: 'right' }}>Preço</th>
                <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('gasto')}>Gasto</th>
                <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('value')}>Valor</th>
                <th style={{ ...th, textAlign: 'right' }} onClick={() => toggleSort('profit')}>Lucro</th>
                {withDividends && <th style={{ ...th, textAlign: 'center' }}>Div.</th>}
                <th style={{ ...th, textAlign: 'center', width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((h, idx) => (
                <HoldingRow key={h.id} h={h} color={h._color} year={year}
                  onUpdate={updateHolding} onRemove={removeHolding} onSell={sellHolding}
                  withDividends={withDividends} mk={mk} locked={locked}
                  isDragOver={overIdx === idx && dragIdx !== idx}
                  isDragging={dragIdx === idx}
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
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--wa-06)' }}>
                <td colSpan={7} style={{ padding: '8px 10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalGasto)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalVal)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: '0.76rem', fontWeight: 700, color: profitColor(totalPct), fontVariantNumeric: 'tabular-nums' }}>
                  {profitSign(totalProfit)}{formatEuro(totalProfit)}
                </td>
                {withDividends && (
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
                    {totalDivs > 0 ? formatEuro(totalDivs) : '—'}
                  </td>
                )}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
