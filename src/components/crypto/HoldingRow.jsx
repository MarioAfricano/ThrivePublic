import { useState } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronUp, X, Calculator,
} from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import {
  CRYPTO_TAX_FREE_DAYS as TAX_FREE_DAYS,
  daysSince,
  holdingPriceAtMk, holdingQtyAtMk, holdingGastoAtMk, holdingValueAtMk,
  lotExistsAtMk, executeSale, simulateSale,
} from '../../utils/calc/cryptoCalc.js'
import { EditableField } from '../ui/EditableField.jsx'
import IRSBadge from './IRSBadge.jsx'
import PriceEditor from './PriceEditor.jsx'
import SellModal from './SellModal.jsx'
import { fmtQty, fmtPrice, profitColor, badge } from './utils.js'

// ── Linha de holding ─────────────────────────────────────────────
// Um holding mostra-se como `<tr>` expansível: clicar na seta revela
// uma sub-linha por lote (apenas lotes que existiam no mês visualizado).
// Quando o mês está fechado o preço vem de `monthData[mk].price` via
// `holdingPriceAtMk`; senão é editável em linha.
// Actions: reforço (novo lote), vender (abre SellModal), calculadora IRS,
// eliminar (com confirmação de 2 passos).
export default function HoldingRow({
  holding, platformId, mk, isLocked,
  onUpdate, onDelete, onAddLot, onDeleteLot, onIRS,
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showSell, setShowSell] = useState(false)

  const qty    = holdingQtyAtMk(holding, mk)
  const value  = holdingValueAtMk(holding, mk)
  const gasto  = holdingGastoAtMk(holding, mk)
  const profit = value - gasto
  const pct    = gasto > 0 ? profit / gasto : 0
  const dispPrice = holdingPriceAtMk(holding, mk)

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--wa-02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

        {/* Expand */}
        <td style={{ padding: '10px 6px 10px 14px', width: 22 }}>
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </td>

        {/* Icon + Ticker */}
        <td style={{ padding: '10px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b',
            }}>
              {holding.ticker?.slice(0, 4)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)' }}>
                <EditableField type="text" value={holding.ticker} fontWeight={700} fontSize="0.87rem" color="var(--text)"
                  onSave={v => onUpdate(platformId, holding.id, { ticker: v.toUpperCase() })} />
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <EditableField type="text" value={holding.name || holding.ticker} fontSize="0.7rem" color="var(--text-muted)"
                  onSave={v => onUpdate(platformId, holding.id, { name: v })} />
              </div>
            </div>
          </div>
        </td>

        {/* Qty */}
        <td style={{ padding: '10px 8px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtQty(qty)}
        </td>

        {/* Price (editable only when month is open) */}
        <td style={{ padding: '10px 8px', fontSize: '0.82rem' }}>
          {isLocked
            ? <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{fmtPrice(dispPrice)}</span>
            : <PriceEditor value={holding.price ?? 0} onSave={p => onUpdate(platformId, holding.id, { price: p })} />}
        </td>

        {/* Value */}
        <td style={{ padding: '10px 8px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {formatEuro(value)}
        </td>

        {/* Cost */}
        <td style={{ padding: '10px 8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {formatEuro(gasto)}
        </td>

        {/* Profit */}
        <td style={{ padding: '10px 8px', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: profitColor(profit) }}>
            {profit >= 0 ? '+' : ''}{formatEuro(profit)}
          </div>
          <div style={{ fontSize: '0.7rem', color: profitColor(pct), opacity: 0.85 }}>
            {profit >= 0 ? '+' : ''}{(pct * 100).toFixed(1)}%
          </div>
        </td>

        {/* IRS */}
        <td style={{ padding: '10px 8px' }}><IRSBadge h={holding} /></td>

        {/* Actions */}
        <td style={{ padding: '10px 10px 10px 8px' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => onAddLot(holding)} title="Reforço" style={{
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 6, color: '#f59e0b', cursor: 'pointer', padding: '4px 8px',
              fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3,
            }}><Plus size={10} /> Reforço</button>

            {!isLocked && qty > 0 && (
              <button onClick={() => setShowSell(true)} title="Vender" style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 6, color: '#ef4444', cursor: 'pointer', padding: '4px 8px',
                fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3,
              }}>Vender</button>
            )}

            <button onClick={() => onIRS(holding)} title="Calculadora IRS" style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px',
              display: 'flex', alignItems: 'center',
            }}><Calculator size={12} /></button>

            {confirmDel ? (
              <>
                <button onClick={() => onDelete(platformId, holding.id)} style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 6,
                  color: '#ef4444', cursor: 'pointer', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700,
                }}>Eliminar</button>
                <button onClick={() => setConfirmDel(false)} style={{
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 5px', display: 'flex',
                }}><X size={11} /></button>
              </>
            ) : (
              <button onClick={() => setConfirmDel(true)} style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px', display: 'flex',
              }}><Trash2 size={12} /></button>
            )}
          </div>
        </td>
      </tr>

      {/* Sub-linhas: lotes que existiam no mês visualizado */}
      {expanded && [...(holding.lots || [])].filter(l => lotExistsAtMk(l, mk))
        .sort((a, b) => new Date(a.buyDate || 0) - new Date(b.buyDate || 0))
        .map(lot => {
          const days = daysSince(lot.buyDate)
          const exempt = days >= TAX_FREE_DAYS
          const left = Math.max(0, TAX_FREE_DAYS - days)
          const lv = (lot.qty || 0) * dispPrice
          const lp = lv - (lot.gasto || 0)
          return (
            <tr key={lot.id} style={{ background: 'rgba(245,158,11,0.025)', borderBottom: '1px solid var(--wa-04)' }}>
              <td colSpan={2} style={{ padding: '7px 8px 7px 50px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>╰ Lote · {lot.buyDate || '—'} · {days}d</span>
              </td>
              <td style={{ padding: '7px 8px', fontSize: '0.73rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtQty(lot.qty)}</td>
              <td style={{ padding: '7px 8px', fontSize: '0.73rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(lot.buyPrice)}</td>
              <td style={{ padding: '7px 8px', fontSize: '0.73rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(lv)}</td>
              <td style={{ padding: '7px 8px', fontSize: '0.73rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(lot.gasto)}</td>
              <td style={{ padding: '7px 8px', fontSize: '0.73rem', fontVariantNumeric: 'tabular-nums', color: profitColor(lp) }}>
                {lp >= 0 ? '+' : ''}{formatEuro(lp)}
              </td>
              <td style={{ padding: '7px 8px' }}>
                <span style={{ ...badge(
                  exempt ? 'var(--green)' : '#fbbf24',
                  exempt ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                  exempt ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)',
                ) }}>
                  {exempt ? 'Isento' : `${left}d`}
                </span>
              </td>
              <td style={{ padding: '7px 10px' }}>
                <button onClick={() => onDeleteLot(platformId, holding.id, lot.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <Trash2 size={11} />
                </button>
              </td>
            </tr>
          )
        })}

      {/* SellModal inline como modal sobreposto — a linha da tabela
          existe só para não partir a estrutura da tabela enquanto o
          portal do modal fica montado. */}
      {showSell && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <SellModal holding={holding} onClose={() => setShowSell(false)}
              onSell={(sellQty, sellPrice) => {
                const sim = simulateSale(holding, sellQty, sellPrice)
                const { newLots, realizedGain, realizedProceeds } = executeSale(holding, sellQty, sellPrice)
                const saleRecord = {
                  date:        new Date().toISOString().slice(0, 10),
                  sellQty,
                  sellPrice,
                  proceeds:    sim?.totalProceeds  ?? realizedProceeds,
                  cost:        sim?.totalCost      ?? (realizedProceeds - realizedGain),
                  gain:        sim?.totalGain      ?? realizedGain,
                  taxableGain: sim?.taxableGain    ?? 0,
                  exemptGain:  sim?.exemptGain     ?? 0,
                  taxDue:      sim?.taxDue         ?? 0,
                }
                onUpdate(platformId, holding.id, {
                  lots: newLots,
                  realizedProfit:   (holding.realizedProfit   || 0) + realizedGain,
                  realizedProceeds: (holding.realizedProceeds || 0) + realizedProceeds,
                  salesHistory: [...(holding.salesHistory || []), saleRecord],
                })
              }} />
          </td>
        </tr>
      )}
    </>
  )
}
