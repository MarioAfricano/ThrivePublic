import { useState } from 'react'
import { Plus } from 'lucide-react'
import { generateId as uid } from '../../utils/id.js'

// ── Entrega / Levantamento num bolso ─────────────────────────────
// Toggle Entrega (+) ↔ Levantamento (−). O valor é sempre positivo no
// input; o sinal é decidido pelo toggle e aplicado ao gravar.
export default function EntregaForm({ onAdd }) {
  const [amount, setAmount]     = useState('')
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [isWithdraw, setIsWithdraw] = useState(false)
  function submit() {
    const a = parseFloat(amount.replace(',', '.'))
    if (isNaN(a) || a <= 0) return
    onAdd({ id: uid(), amount: isWithdraw ? -a : a, date })
    setAmount('')
  }
  const st = { background: 'var(--bg-elevated)', border: '1px solid var(--wa-10)', borderRadius: 5, color: 'var(--text)', padding: '3px 7px', fontSize: '0.7rem', outline: 'none' }
  const toggleStyle = (active, color) => ({
    background: active ? color : 'var(--bg-elevated)',
    color: active ? '#fff' : 'var(--text-muted)',
    border: `1px solid ${active ? color : 'var(--wa-10)'}`,
    borderRadius: 4, padding: '2px 7px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        <button onClick={() => setIsWithdraw(false)} style={toggleStyle(!isWithdraw, 'var(--accent)')}>Entrega</button>
        <button onClick={() => setIsWithdraw(true)}  style={toggleStyle(isWithdraw,  '#ef4444')}>Levantamento</button>
      </div>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...st, width: 110 }} />
      <input placeholder="Valor €" value={amount} onChange={e => setAmount(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()} style={{ ...st, width: 70 }} />
      <button onClick={submit} style={{ background: isWithdraw ? '#ef4444' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}>
        <Plus size={10} />
      </button>
    </div>
  )
}
