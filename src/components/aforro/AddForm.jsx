import { useState } from 'react'
import { generateId as uid } from '../../utils/id.js'
import Button from '../ui/Button.jsx'
import { capAforroBaseRate, AFORRO_EURIBOR_CAP } from '../../utils/calc/savingsCalc.js'

// ── Formulário inline de novo certificado ───────────────────────
// Data, montante, nota opcional. Taxa inicial preenchida com o
// Euribor actual no período 0 do rateHistory.
export default function AddForm({ onAdd, euribor, onClose }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]   = useState(today)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const amountNum = parseFloat(amount.replace(',', '.'))
  const canSubmit = !isNaN(amountNum) && amountNum > 0 && date

  function submit() {
    if (!canSubmit) return
    onAdd({
      id: uid(),
      date,
      amount: amountNum,
      rateHistory: { 0: euribor || 0 }, // Euribor observada; o tecto da Série F aplica-se no cálculo
      valueOverride: null,
      notes: notes.trim(),
    })
  }

  const inp = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '6px 10px',
    fontSize: '0.82rem', outline: 'none', width: '100%',
  }

  return (
    <div style={{ padding: '14px 20px', background: 'rgba(129,140,248,0.05)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 140 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data subscrição</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Montante (€)</label>
          <input placeholder="5000" value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            style={inp} />
        </div>
        <div style={{ minWidth: 160, flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nota (opcional)</label>
          <input placeholder="ex: renovar em Março" value={notes} onChange={e => setNotes(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 0 }}>
          {euribor > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', paddingBottom: 8 }}>
              Taxa inicial: <strong style={{ color: 'var(--text)' }}>{(capAforroBaseRate(euribor) * 100).toFixed(3)}%</strong>
              {euribor > AFORRO_EURIBOR_CAP && (
                <span title={`Euribor 3M está em ${(euribor * 100).toFixed(3)}%; a Série F limita a componente Euribor a ${(AFORRO_EURIBOR_CAP * 100).toFixed(2)}%.`}>
                  {' '}(tecto Série F)
                </span>
              )}
            </span>
          )}
          <Button size="sm" onClick={submit} disabled={!canSubmit}
            style={{ background: canSubmit ? 'var(--accent)' : 'rgba(129,140,248,0.25)', border: 'none', color: canSubmit ? '#fff' : 'var(--text-muted)' }}>
            Adicionar
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
