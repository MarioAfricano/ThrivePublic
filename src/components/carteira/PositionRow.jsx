import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, GripVertical } from 'lucide-react'
import {
  formatEuro, formatPct, holdingQtyAtMk, holdingGastoAtMk,
} from '../../data/initialData.js'
import { EditableField } from '../ui/EditableField.jsx'
import { profitColor, mkLabel, calcRecebido, earliestBuyMk, TAX_RATE } from './utils.js'

// ── Linha de posição (Ação ou ETF) ───────────────────────────────
// Renderiza uma `<tr>` para cada holding + sub-rows para os lots (se
// expandida). Quando a posição está vendida mostra colunas extra:
// mês/preço/recebido/lucro bruto/lucro líquido (−28% IRS).
// `Recebido` é editável como override; o ícone RotateCcw repõe o
// cálculo automático. Drag-and-drop via props `dragProps`; a pega
// também aceita ↑/↓ para reordenar sem rato (`onMoveUp`/`onMoveDown`).
export default function PositionRow({
  h, tipo, onUpdate, dragProps, isDragOver, isDragging,
  rowIndex, rowCount, onMoveUp, onMoveDown,
}) {
  const [expanded, setExpanded] = useState(false)

  const isSold     = !!h.sellMk
  const buyMk      = earliestBuyMk(h)
  const sellQty    = h.sellQty ?? holdingQtyAtMk(h, h.sellMk)
  const activeQty  = holdingQtyAtMk(h, null)
  const gasto      = holdingGastoAtMk(h, null)
  const recebido   = isSold ? calcRecebido(h) : null
  // Lucro bruto e líquido (IRS só sobre ganhos; perdas não acumulam aqui).
  const lucroBruto = recebido !== null ? recebido - gasto : null
  const imposto    = lucroBruto !== null && lucroBruto > 0 ? lucroBruto * TAX_RATE : 0
  const lucroLiq   = lucroBruto !== null ? lucroBruto - imposto : null
  const lucroPct   = gasto > 0 && lucroBruto !== null ? lucroBruto / gasto : null
  const hasManualTotal = isSold && h.sellTotal != null

  // Propaga alterações de venda para o parent.
  function updateSell(changes) { onUpdate({ ...h, ...changes }) }

  const td = (extra = {}) => ({
    padding: '8px 8px', fontSize: '0.74rem', color: 'var(--text)',
    borderBottom: '1px solid var(--wa-04)', verticalAlign: 'middle',
    ...extra,
  })

  const lots = h.lots || []

  // `draggable` fica só na pega, não na linha: o browser marca qualquer
  // elemento arrastável como user-select:none, e isso impedia selecionar
  // os valores da tabela. A linha continua a ser o alvo do drop.
  const { draggable, onDragStart, ...rowDragProps } = dragProps || {}

  return (
    <>
      <tr style={{
          transition: 'background 0.1s, opacity 0.1s',
          opacity: isDragging ? 0.35 : (isSold ? 0.85 : 1),
          background: isDragOver ? 'rgba(129,140,248,0.07)' : expanded ? 'var(--wa-015)' : 'transparent',
          borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
        }}
        {...rowDragProps}>

        {/* Pega de arrastar — botão real para funcionar com teclado */}
        <td style={{ ...td(), paddingLeft: 6, paddingRight: 2, width: 18 }}>
          {dragProps && (
            <button
              type="button"
              draggable={draggable}
              onDragStart={onDragStart}
              aria-label={`Reordenar ${h.ticker}${rowCount ? `, posição ${rowIndex + 1} de ${rowCount}` : ''}. Use as setas para cima e para baixo.`}
              onKeyDown={e => {
                if (e.key === 'ArrowUp'   && onMoveUp)   { e.preventDefault(); onMoveUp() }
                if (e.key === 'ArrowDown' && onMoveDown) { e.preventDefault(); onMoveDown() }
              }}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: 'var(--text-muted)', cursor: 'grab', display: 'block',
              }}>
              <GripVertical size={12} aria-hidden="true" style={{ display: 'block' }} />
            </button>
          )}
        </td>

        {/* Ticker + expand toggle */}
        <td style={td()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {lots.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Ocultar' : 'Mostrar'} compras de ${h.ticker}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0, flexShrink: 0 }}>
                {expanded ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
              </button>
            )}
            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{h.ticker}</span>
            <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: 3,
              background: tipo === 'acoes' ? 'var(--green-dim)' : 'rgba(34,211,238,0.12)',
              color: tipo === 'acoes' ? 'var(--green)' : '#22d3ee', fontWeight: 600 }}>
              {tipo === 'acoes' ? 'Ação' : 'ETF'}
            </span>
          </div>
        </td>

        {/* Nome */}
        <td style={td({ color: 'var(--text-secondary)', fontSize: '0.7rem', maxWidth: 160 })}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {h.name || h.ticker}
          </span>
        </td>

        {/* Estado */}
        <td style={td({ textAlign: 'center' })}>
          {isSold ? (
            <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10,
              background: 'rgba(251,191,36,0.12)', color: 'var(--yellow)', fontWeight: 600 }}>
              Vendida
            </span>
          ) : (
            <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10,
              background: 'var(--green-dim)', color: 'var(--green)', fontWeight: 600 }}>
              Activa
            </span>
          )}
        </td>

        {/* Qtd */}
        <td style={td({ textAlign: 'right', fontVariantNumeric: 'tabular-nums' })}>
          {isSold ? sellQty : activeQty}
        </td>

        {/* Investido */}
        <td style={td({ textAlign: 'right', fontVariantNumeric: 'tabular-nums' })}>
          {formatEuro(gasto)}
        </td>

        {/* Mês compra */}
        <td style={td({ fontSize: '0.68rem', color: 'var(--text-muted)' })}>
          {mkLabel(buyMk)}
        </td>

        {/* Plataforma */}
        <td style={td({ fontSize: '0.68rem', color: 'var(--text-muted)' })}>
          {h.platform || '—'}
        </td>

        {/* ── Colunas de venda ── */}
        <td style={td({ fontSize: '0.68rem', color: isSold ? 'var(--text-muted)' : 'var(--wa-15)' })}>
          {isSold ? mkLabel(h.sellMk) : '—'}
        </td>

        {/* Preço de venda (editável) */}
        <td style={td({ textAlign: 'right' })}>
          {isSold ? (
            <EditableField
              type="number"
              value={h.sellPrice ?? 0}
              formatter={v => v ? formatEuro(v) : '—'}
              onSave={v => updateSell({ sellPrice: v, sellTotal: undefined })}
              width={72}
              fontSize="0.78rem"
              fontWeight={600}
            />
          ) : <span style={{ color: 'var(--wa-10)' }}>—</span>}
        </td>

        {/* Total recebido (editável, override) */}
        <td style={td({ textAlign: 'right' })}>
          {isSold ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <EditableField
                type="number"
                value={recebido}
                formatter={formatEuro}
                onSave={v => updateSell({ sellTotal: v })}
                width={80}
                fontSize="0.78rem"
                fontWeight={600}
              />
              {hasManualTotal && (
                <button
                  type="button"
                  onClick={() => updateSell({ sellTotal: undefined })}
                  aria-label={`Repor cálculo automático do recebido de ${h.ticker}`}
                  title="Valor inserido manualmente — clica para repor automático"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--yellow)', display: 'flex', padding: 0 }}>
                  <RotateCcw size={10} aria-hidden="true" />
                </button>
              )}
            </span>
          ) : <span style={{ color: 'var(--wa-10)' }}>—</span>}
        </td>

        {/* Lucro bruto */}
        <td style={td({ textAlign: 'right' })}>
          {isSold && lucroBruto !== null ? (
            <div>
              <span style={{ fontWeight: 700, color: profitColor(lucroPct), fontVariantNumeric: 'tabular-nums', fontSize: '0.76rem' }}>
                {lucroBruto >= 0 ? '+' : ''}{formatEuro(lucroBruto)}
              </span>
              <span style={{ display: 'block', fontSize: '0.6rem', color: profitColor(lucroPct) }}>
                {formatPct(lucroPct, { signed: true })}
              </span>
            </div>
          ) : <span style={{ color: 'var(--wa-10)' }}>—</span>}
        </td>

        {/* Lucro líquido (após 28% IRS sobre ganhos) */}
        <td style={td({ textAlign: 'right' })}>
          {isSold && lucroLiq !== null ? (
            <div>
              <span style={{ fontWeight: 700, color: profitColor(lucroPct), fontVariantNumeric: 'tabular-nums', fontSize: '0.76rem' }}>
                {lucroLiq >= 0 ? '+' : ''}{formatEuro(lucroLiq)}
              </span>
              {imposto > 0 && (
                <span style={{ display: 'block', fontSize: '0.58rem', color: 'var(--red)' }}>
                  IRS: -{formatEuro(imposto)}
                </span>
              )}
            </div>
          ) : <span style={{ color: 'var(--wa-10)' }}>—</span>}
        </td>
      </tr>

      {/* Sub-rows: detalhe dos lots (expandível) */}
      {expanded && lots.length > 0 && lots.map(lot => (
        <tr key={lot.id} style={{ background: 'rgba(129,140,248,0.03)' }}>
          <td style={td()} />
          <td style={{ ...td(), paddingLeft: 28 }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>↳ compra</span>
          </td>
          <td colSpan={2} style={td({ fontSize: '0.62rem', color: 'var(--text-muted)' })}>
            {mkLabel(lot.buyMk)} · {lot.qty} un.
          </td>
          <td style={td({ textAlign: 'right', fontSize: '0.62rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' })}>
            {lot.qty}
          </td>
          <td style={td({ textAlign: 'right', fontSize: '0.62rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' })}>
            {formatEuro(lot.gasto ?? lot.qty * lot.price)}
          </td>
          <td colSpan={8} style={td({ fontSize: '0.62rem', color: 'var(--text-muted)' })}>
            {formatEuro(lot.price)}/un.{lot.taxa ? ` · taxa ${formatEuro(lot.taxa)}` : ''}
          </td>
        </tr>
      ))}
    </>
  )
}
