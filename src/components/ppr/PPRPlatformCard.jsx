import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  formatEuro, getMK, MONTHS_SHORT,
  calcPPRTotal, isAccVisible,
} from '../../data/initialData.js'
import { EditableField } from '../ui/EditableField.jsx'
import Sparkline from './Sparkline.jsx'
import PPRAccountRow from './PPRAccountRow.jsx'

// ── Card de plataforma PPR ───────────────────────────────────────
// Header tem nome editável, saldo total, sparkline do ano. Expandível
// lista contas filhas + botão "Adicionar conta". Remover plataforma
// é soft-delete (marca deletedFromMK para preservar histórico).
export default function PPRPlatformCard({ platform, mk, onUpdate, onRemove }) {
  const [expanded,      setExpanded]      = useState(true)
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccName,    setNewAccName]    = useState('')

  const total = calcPPRTotal([platform], mk)
  const [mkYear, mkMonth] = mk.split('-').map(Number)
  const sparkVals = MONTHS_SHORT.map((_, m) => {
    if (m > mkMonth) return null
    const mkey = getMK(mkYear, m)
    if (m < mkMonth && !platform.accounts.some(a => !!a.monthData?.[mkey])) return null
    return calcPPRTotal([platform], mkey)
  })

  function updateAccount(updated) {
    onUpdate({ ...platform, accounts: platform.accounts.map(a => a.id === updated.id ? updated : a) })
  }

  function removeAccount(id) {
    // Soft-delete: conta fica nos dados históricos, só desaparece a partir deste mês.
    onUpdate({ ...platform, accounts: platform.accounts.map(a => a.id === id ? { ...a, deletedFromMK: mk } : a) })
  }

  function addAccount() {
    if (!newAccName.trim()) return
    const acc = { id: `${platform.id}-${Date.now()}`, name: newAccName.trim(), contributions: [], monthData: {}, startMK: mk }
    onUpdate({ ...platform, accounts: [...platform.accounts, acc] })
    setNewAccName(''); setAddingAccount(false)
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: platform.color, flexShrink: 0 }} />
        <EditableField type="text" value={platform.name} width={180} fontSize="0.85rem" onSave={name => onUpdate({ ...platform, name })} />
        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {formatEuro(total)}
        </span>
        <div style={{ marginLeft: 'auto', opacity: 0.75 }}>
          <Sparkline vals={sparkVals} color={platform.color} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div>
          {platform.accounts.filter(a => isAccVisible(a, mk)).map(acc => (
            <PPRAccountRow key={acc.id} account={acc} mk={mk}
              onUpdate={updateAccount} onRemove={() => removeAccount(acc.id)} />
          ))}
          {addingAccount ? (
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Nome da conta" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') addAccount(); if (e.key === 'Escape') setAddingAccount(false) }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '6px 10px', fontSize: '0.82rem', outline: 'none', flex: 1 }} />
              <button onClick={() => setAddingAccount(false)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={addAccount} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#818cf8,#6366f1)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Adicionar</button>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px' }}>
              <button onClick={() => setAddingAccount(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '4px 0' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <Plus size={13} /> Adicionar conta
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
