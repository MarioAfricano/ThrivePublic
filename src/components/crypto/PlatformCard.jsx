import { useState } from 'react'
import {
  Plus, Trash2, ChevronDown, X, Bitcoin, Building2,
} from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import {
  holdingValueAtMk, holdingGastoAtMk, holdingTaxBreakdown,
} from '../../utils/calc/cryptoCalc.js'
import { EditableField } from '../ui/EditableField.jsx'
import HoldingRow from './HoldingRow.jsx'
import AddHoldingModal from './AddHoldingModal.jsx'
import AddLotModal from './AddLotModal.jsx'
import IRSCalcModal from './IRSCalcModal.jsx'
import { profitColor } from './utils.js'

// ── Cartão de plataforma ─────────────────────────────────────────
// Agrega vários holdings. Cabeçalho mostra nome editável, contagem de
// ativos, total de valor/lucro e IRS estimado agregado. Expande para
// uma tabela de holdings. Rename inline, eliminar com confirmação 2
// passos. Gere internamente 3 modais: adicionar holding, adicionar lote,
// calculadora IRS.
export default function PlatformCard({
  platform, mk, isLocked,
  onRename, onDelete, onAddHolding, onUpdate, onDeleteHolding, onAddLot, onDeleteLot,
}) {
  const [expanded,    setExpanded]    = useState(true)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [addHolding,  setAddHolding]  = useState(false)
  const [addLotFor,   setAddLotFor]   = useState(null)
  const [irsFor,      setIrsFor]      = useState(null)

  const totalV = platform.holdings.reduce((s, h) => s + holdingValueAtMk(h, mk), 0)
  const totalG = platform.holdings.reduce((s, h) => s + holdingGastoAtMk(h, mk), 0)
  const totalP = totalV - totalG
  const totalIRS = platform.holdings.reduce((s, h) => s + holdingTaxBreakdown(h).taxDue, 0)

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
        borderBottom: expanded ? '1px solid var(--border)' : 'none', cursor: 'pointer',
      }}
        onClick={() => setExpanded(!expanded)}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 size={18} style={{ color: '#f59e0b' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
            <EditableField type="text" value={platform.name} fontWeight={700} fontSize="0.95rem" color="var(--text)"
              onSave={n => onRename(platform.id, n)} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {platform.holdings.length} ativo{platform.holdings.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 2 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalV)}</span>
            <span style={{ fontSize: '0.75rem', color: profitColor(totalP), fontVariantNumeric: 'tabular-nums' }}>
              {totalP >= 0 ? '+' : ''}{formatEuro(totalP)}
            </span>
            {totalIRS > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
                IRS est.: {formatEuro(totalIRS)}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setAddHolding(true)} style={{
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8,
            color: '#f59e0b', cursor: 'pointer', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
          }}><Plus size={12} /> Criptomoeda</button>

          {confirmDel ? (
            <>
              <button onClick={() => onDelete(platform.id)} style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 8,
                color: '#ef4444', cursor: 'pointer', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700,
              }}>Eliminar</button>
              <button onClick={() => setConfirmDel(false)} style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 8px', display: 'flex',
              }}><X size={13} /></button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 8px', display: 'flex',
            }}><Trash2 size={13} /></button>
          )}
        </div>
        <ChevronDown size={15} style={{
          color: 'var(--text-muted)', flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
        }} />
      </div>

      {/* Tabela de holdings */}
      {expanded && (
        platform.holdings.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Bitcoin size={36} style={{ color: 'rgba(245,158,11,0.25)', display: 'block', margin: '0 auto 10px' }} />
            Nenhuma criptomoeda ainda.
            <br />
            <button onClick={() => setAddHolding(true)} style={{
              marginTop: 12, background: 'transparent',
              border: '1px dashed rgba(245,158,11,0.4)',
              borderRadius: 8, color: '#f59e0b', cursor: 'pointer',
              padding: '8px 18px', fontSize: '0.82rem',
            }}>+ Adicionar primeira criptomoeda</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Ativo', 'Quantidade', 'Preço Atual', 'Valor', 'Investido', 'Lucro / Perda', 'IRS', 'Ações'].map((h, i) => (
                    <th key={i} style={{
                      padding: i === 0 ? '8px 6px 8px 14px' : '8px',
                      textAlign: 'left', fontSize: '0.68rem', color: 'var(--text-muted)',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platform.holdings.map(h => (
                  <HoldingRow key={h.id} holding={h} platformId={platform.id} mk={mk} isLocked={isLocked}
                    onUpdate={onUpdate}
                    onDelete={onDeleteHolding}
                    onAddLot={(hh) => setAddLotFor(hh)}
                    onDeleteLot={onDeleteLot}
                    onIRS={(hh) => setIrsFor(hh)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {addHolding && <AddHoldingModal onAdd={h => onAddHolding(platform.id, h)} onClose={() => setAddHolding(false)} />}
      {addLotFor  && <AddLotModal    holding={addLotFor} onAdd={lot => onAddLot(platform.id, addLotFor.id, lot)} onClose={() => setAddLotFor(null)} />}
      {irsFor     && <IRSCalcModal   holding={irsFor} onClose={() => setIrsFor(null)} />}
    </div>
  )
}
