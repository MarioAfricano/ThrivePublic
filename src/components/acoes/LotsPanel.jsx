import { Trash2 } from 'lucide-react'
import { formatEuro, MONTHS_SHORT } from '../../data/initialData.js'
import { EditableField } from '../ui/EditableField.jsx'
import { formatNative } from './utils.js'
import AddLotForm from './AddLotForm.jsx'

// ── Painel de compras / lotes ───────────────────────────────────
// Linha expandida por baixo de um HoldingRow: lista os lotes de compra,
// as vendas parciais (sell lots, qty negativa), o total das compras e o
// formulário de nova compra. Todas as mutações sobem via callbacks.
const GRID = '90px 65px 80px 80px 70px 24px'

// Formata buyMk para label legível (ex: "2024-3" → "Abr 2024")
function mkLabel(m) {
  if (!m) return '—'
  const [y, mo] = m.split('-').map(Number)
  return `${MONTHS_SHORT[mo]} ${y}`
}

export default function LotsPanel({ h, mk, locked, colSpan, onAddLot, onRemoveLot, onUpdateLot }) {
  const buyLots  = (h.lots || []).filter(l => !l.isSell)
  const sellLots = (h.lots || []).filter(l => l.isSell)

  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '6px 16px 10px 30px', background: 'rgba(129,140,248,0.03)', borderBottom: '1px solid var(--wa-04)' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          Compras — {h.ticker}
        </div>

        {/* Cabeçalho da tabela de lotes */}
        {(h.lots?.length || 0) > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, marginBottom: 3 }}>
            {['Mês', 'Qtd', 'Preço/un.', 'Gasto', 'Taxa', ''].map((label, i) => (
              <span key={i} style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px 3px' }}>{label}</span>
            ))}
          </div>
        )}

        {/* Lista de lotes de compra */}
        {buyLots.map(lot => (
          <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, marginBottom: 2, alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--wa-02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 4px' }}>{mkLabel(lot.buyMk)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', padding: '2px 4px' }}>{(lot.qty || 0).toFixed(4)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', padding: '2px 4px' }}>{formatNative(lot.price, h.currency)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, padding: '2px 4px' }}>{formatEuro(lot.gasto)}</span>
            <span style={{ fontSize: '0.68rem', color: (lot.taxa || 0) > 0 ? '#fbbf24' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', opacity: (lot.taxa || 0) > 0 ? 1 : 0.3, padding: '2px 4px' }}>
              {(lot.taxa || 0) > 0 ? formatEuro(lot.taxa) : '—'}
            </span>
            {!locked && (
              <button onClick={() => onRemoveLot(lot.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <Trash2 size={9} />
              </button>
            )}
          </div>
        ))}

        {/* Sell lots (vendas parciais) */}
        {sellLots.length > 0 && (
          <>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 4px', opacity: 0.8 }}>
              Vendas parciais
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, marginBottom: 3 }}>
              {['Mês venda', 'Qtd', 'Preço/un.', 'Recebido', '', ''].map((label, i) => (
                <span key={i} style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px 3px' }}>{label}</span>
              ))}
            </div>
            {sellLots.map(lot => (
              <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, marginBottom: 2, alignItems: 'center', background: 'rgba(251,191,36,0.04)', borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,191,36,0.04)'}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 4px' }}>{mkLabel(lot.buyMk)}</span>
                <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontVariantNumeric: 'tabular-nums', padding: '2px 4px' }}>{Math.abs(lot.qty || 0).toFixed(4)}</span>
                <EditableField type="number" value={lot.sellPrice ?? 0} formatter={v => v ? formatNative(v, h.currency) : '—'}
                  onSave={v => {
                    const qty = Math.abs(lot.qty || 0)
                    const newTotal = lot.sellTotal != null ? lot.sellTotal : v * qty
                    onUpdateLot(lot.id, { sellPrice: v, sellTotal: newTotal })
                  }} fontSize="0.7rem" width={75} locked={locked} />
                <EditableField type="number" value={lot.sellTotal ?? 0} formatter={v => v ? formatEuro(v) : '—'}
                  onSave={v => onUpdateLot(lot.id, { sellTotal: v })} fontSize="0.7rem" width={75} locked={locked} />
                <span />
                {!locked && (
                  <button onClick={() => onRemoveLot(lot.id)} title="Desfazer venda parcial"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, justifyContent: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <Trash2 size={9} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {(h.lots?.length || 0) === 0 && (
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.5, marginBottom: 4 }}>Sem compras registadas</p>
        )}

        {/* Separador + total (apenas compras) */}
        {buyLots.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: GRID, marginTop: 2, paddingTop: 4, borderTop: '1px solid var(--wa-06)' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, padding: '2px 4px' }}>Total compras</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '2px 4px' }}>
              {buyLots.reduce((s, l) => s + (l.qty || 0), 0).toFixed(4)}
            </span>
            <span />
            <span style={{ fontSize: '0.68rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '2px 4px' }}>
              {formatEuro(buyLots.reduce((s, l) => s + (l.gasto || 0), 0))}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#fbbf24', fontVariantNumeric: 'tabular-nums', padding: '2px 4px' }}>
              {buyLots.some(l => (l.taxa || 0) > 0)
                ? formatEuro(buyLots.reduce((s, l) => s + (l.taxa || 0), 0)) : '—'}
            </span>
          </div>
        )}

        {/* Formulário de nova compra — só se mês não está fechado */}
        {!locked && (
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--wa-05)' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
              Nova compra
            </span>
            <AddLotForm h={h} mk={mk} onAdd={onAddLot} />
          </div>
        )}
      </td>
    </tr>
  )
}
