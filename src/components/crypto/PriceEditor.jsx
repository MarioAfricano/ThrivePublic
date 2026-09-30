import { useState } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { S } from './constants.js'
import { fmtPrice } from './utils.js'

// ── Editor inline de preço ────────────────────────────────────────
// Click-to-edit com aceitação de vírgula como decimal. Enter/blur
// comitam, Escape cancela. Mostra o ícone RefreshCw para indicar que
// é editável (como se fosse uma atualização manual de preço).
export default function PriceEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => { const n = parseFloat(draft.replace(',', '.')); if (!isNaN(n)) onSave(n); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { const n = parseFloat(draft.replace(',', '.')); if (!isNaN(n)) onSave(n); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{ ...S.input, width: 110, padding: '3px 7px', fontSize: '0.82rem', fontWeight: 600 }} />
      <button onClick={() => setEditing(false)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
        <X size={11} />
      </button>
    </span>
  )

  return (
    <span onClick={() => { setDraft(String(value)); setEditing(true) }}
      title="Clica para actualizar preço"
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
      {fmtPrice(value)} <RefreshCw size={10} style={{ color: 'var(--text-muted)' }} />
    </span>
  )
}
