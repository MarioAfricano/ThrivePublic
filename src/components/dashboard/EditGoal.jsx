import { useState, useRef, useEffect } from 'react'
import { Pencil, Check } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'

// ── Editor inline do objetivo anual ────────────────────────────
// Modo leitura: valor formatado com sublinhado tracejado + ícone de
// lápis. Clique entra em modo edição (input autofocado, aceita
// vírgula como separador decimal). Enter confirma, Escape cancela.
export default function EditGoal({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)
  useEffect(() => { if (editing) ref.current?.select() }, [editing])

  function commit() {
    const n = parseFloat(draft.replace(',', '.'))
    if (!isNaN(n)) onSave(n)
    setEditing(false)
  }

  if (editing) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label="Objetivo anual em euros"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', fontSize: '0.95rem', fontWeight: 700, width: 90, padding: '2px 8px' }} />
      <button type="button" onClick={commit} aria-label="Guardar objetivo"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'flex' }}>
        <Check size={13} aria-hidden="true" />
      </button>
    </span>
  )
  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      aria-label={`Objetivo anual: ${formatEuro(value, 0)}. Clica para editar.`}
      style={{ background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', border: 'none', borderBottom: '1px dashed var(--wa-18)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'var(--wa-18)'}>
      {formatEuro(value, 0)}<Pencil size={9} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
    </button>
  )
}
