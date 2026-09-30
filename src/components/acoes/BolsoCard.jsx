import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { bolsoInvestidoAtMk } from '../../utils/calc/stockCalc.js'
import { EditableField } from '../ui/EditableField.jsx'
import { profitColor, profitSign } from './utils.js'
import EntregaForm from './EntregaForm.jsx'

// ── Bolso (pocket) ──────────────────────────────────────────────
// Bolso é uma alocação genérica (ex: Trading 212 Invest Pie) — não tem
// holdings individuais, só valorAtual (editável com snapshot por mês
// via `monthData[mk].valorAtual`) e uma lista de entregas/levantamentos
// que somadas dão o investido real.
export default function BolsoCard({ bolso, onUpdate, onRemove, mk, locked }) {
  const [showEntregas, setShowEntregas] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Valor actual: usa o snapshot do mês se existir, senão o valor base
  const valorAtual = mk && bolso.monthData?.[mk]?.valorAtual != null
    ? bolso.monthData[mk].valorAtual
    : (bolso.valorAtual || 0)

  function saveValorAtual(v) {
    const monthData = { ...(bolso.monthData || {}), [mk]: { ...(bolso.monthData?.[mk] || {}), valorAtual: v } }
    onUpdate({ ...bolso, monthData })
  }

  const investido = bolsoInvestidoAtMk(bolso, mk)
  const profit = valorAtual - investido
  const pct = investido > 0 ? profit / investido : 0

  function addEntrega(e) {
    const newEntregas = [...(bolso.entregas || []), e]
    onUpdate({ ...bolso, entregas: newEntregas, valorInvestido: newEntregas.reduce((s, x) => s + x.amount, 0) })
  }
  function removeEntrega(eId) {
    const newEntregas = (bolso.entregas || []).filter(e => e.id !== eId)
    onUpdate({ ...bolso, entregas: newEntregas, valorInvestido: newEntregas.reduce((s, x) => s + x.amount, 0) })
  }

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wallet size={13} style={{ color: '#22d3ee' }} />
          <EditableField type="text" value={bolso.name} onSave={v => onUpdate({ ...bolso, name: v })} width={120} fontSize="0.82rem" fontWeight={700} color="var(--text)" />
        </div>
        <EditableField type="text" value={bolso.platform} onSave={v => onUpdate({ ...bolso, platform: v })} width={80} fontSize="0.72rem" />
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 1 }}>Valor atual</p>
          <EditableField type="number" value={valorAtual} onSave={saveValorAtual} formatter={v => formatEuro(v)} width={85} fontSize="0.9rem" locked={locked} />
        </div>
        <div>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 1 }}>Investido</p>
          <EditableField type="number" value={investido} onSave={v => onUpdate({ ...bolso, valorInvestido: v })} formatter={v => formatEuro(v)} width={85} fontSize="0.82rem" />
        </div>
        <div>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 1 }}>Lucro</p>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: profitColor(pct), fontVariantNumeric: 'tabular-nums' }}>
            {profitSign(profit)}{formatEuro(profit)} <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>({profitSign(pct)}{(pct * 100).toFixed(1)}%)</span>
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setShowEntregas(!showEntregas)}
          style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.65rem', padding: 0 }}>
          Entregas ({(bolso.entregas || []).length}) {showEntregas ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
        </button>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
            <button onClick={() => onRemove(bolso.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: '0.6rem', cursor: 'pointer', fontWeight: 600 }}>Eliminar</button>
            <button onClick={() => setConfirmDelete(false)} style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: '0.6rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, marginLeft: 'auto' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {showEntregas && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--wa-05)' }}>
          {(bolso.entregas || []).map(e => {
            const isNeg = e.amount < 0
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: '0.65rem', color: isNeg ? '#ef4444' : 'var(--accent)', fontWeight: 600, width: 72, flexShrink: 0 }}>{isNeg ? 'Levantamento' : 'Entrega'}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', minWidth: 70 }}>{e.date || '—'}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isNeg ? '#ef4444' : 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                  {isNeg ? '−' : '+'}{formatEuro(Math.abs(e.amount))}
                </span>
                <button onClick={() => removeEntrega(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 1, marginLeft: 'auto' }}
                  onMouseEnter={ev => ev.currentTarget.style.color = '#ef4444'} onMouseLeave={ev => ev.currentTarget.style.color = 'var(--text-muted)'}>
                  <Trash2 size={9} />
                </button>
              </div>
            )
          })}
          <EntregaForm onAdd={addEntrega} />
        </div>
      )}
    </div>
  )
}
