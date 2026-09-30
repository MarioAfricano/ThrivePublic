import { useState } from 'react'
import { Plus } from 'lucide-react'
import { getMK } from '../../data/initialData.js'
import { generateId as uid } from '../../utils/id.js'

// ── Formulário dividendos (inline) ───────────────────────────────
// Usado dentro do `DivsModal` para acrescentar um dividendo ao ano
// activo. Preenche automaticamente a data de hoje; o `mk` é derivado.
export default function DividendForm({ onAdd }) {
  const [amount, setAmount] = useState('')
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  function submit() {
    const a = parseFloat(amount.replace(',', '.'))
    if (isNaN(a) || a <= 0) return
    const d = new Date(date)
    const mk = getMK(d.getFullYear(), d.getMonth())
    onAdd({ id: uid(), amount: a, date, mk })
    setAmount('')
  }
  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--wa-10)', borderRadius: 5, color: 'var(--text)', padding: '3px 7px', fontSize: '0.72rem', outline: 'none' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 110 }} />
      <input placeholder="Valor €" value={amount} onChange={e => setAmount(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()} style={{ ...inputStyle, width: 70 }} />
      <button onClick={submit} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
        <Plus size={10} />
      </button>
    </div>
  )
}
