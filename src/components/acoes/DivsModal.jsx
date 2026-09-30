import { Trash2, X } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import DividendForm from './DividendForm.jsx'
import Modal from '../ui/Modal.jsx'

// ── Modal de dividendos ──────────────────────────────────────────
// Lista dividendos do ano + total no topo; permite adicionar/apagar
// (excepto se o mês estiver fechado). Escape fecha o modal. Aceita
// dividendos antigos com `date` ou novos com `mk`.
export default function DivsModal({ h, year, locked, onClose, onAdd, onRemove }) {
  const yearDivs = (h.dividends || []).filter(d => {
    if (d.mk)   { const [y] = d.mk.split('-').map(Number); return y === year }
    if (d.date) return new Date(d.date).getFullYear() === year
    return false
  })
  const total = yearDivs.reduce((s, d) => s + (d.amount || 0), 0)

  return (
    <Modal onClose={onClose} width={420} style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
            {h.ticker} — Dividendos {year}
          </span>
          {total > 0 && (
            <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatEuro(total)}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <X size={16} />
        </button>
      </div>
      {/* Lista */}
      {yearDivs.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.6, marginBottom: 12 }}>Sem dividendos registados neste ano</p>
      ) : (
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {yearDivs.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--wa-025)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>{d.date || '—'}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(d.amount)}</span>
              {!locked && (
                <button onClick={() => onRemove(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Adicionar */}
      {!locked && (
        <div style={{ borderTop: '1px solid var(--wa-07)', paddingTop: 12 }}>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Adicionar dividendo</p>
          <DividendForm onAdd={div => { onAdd(div) }} />
        </div>
      )}
    </Modal>
  )
}
