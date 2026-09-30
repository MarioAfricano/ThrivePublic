import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'

// ── Editor inline de taxa (%) ────────────────────────────────────
// Compacto: ícone pencil → abre input pequeno → Enter/blur commit,
// Escape cancela. Opcionalmente mostra ↺ para limpar override
// (voltar ao valor automático/Euribor).
export default function EditRate({ rate, onSave, onClear }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  function commit() {
    const n = parseFloat(draft.replace(',', '.'))
    if (!isNaN(n)) onSave(n / 100)
    setEditing(false)
  }
  if (editing) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
        placeholder={(rate * 100).toFixed(3)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)', outline: 'none', fontSize: '0.72rem', width: 64, padding: '1px 5px', fontVariantNumeric: 'tabular-nums' }} />
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>%</span>
      <button onClick={commit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'flex' }}><Check size={10} /></button>
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => { setDraft((rate * 100).toFixed(3)); setEditing(true) }}
        title="Editar taxa deste período"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 1 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
        <Pencil size={10} />
      </button>
      {onClear && (
        <button onClick={onClear} title="Repor para Euribor actual"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 1, fontSize: '0.72rem', lineHeight: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = '#fbbf24'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          ↺
        </button>
      )}
    </span>
  )
}
