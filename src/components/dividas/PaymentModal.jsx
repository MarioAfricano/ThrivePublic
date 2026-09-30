import { useState } from 'react'
import { X } from 'lucide-react'
import { MONTHS, formatEuro } from '../../data/initialData.js'
import Field from './Field.jsx'
import { inputStyle } from './ui.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

// ── Modal: registar pagamento ────────────────────────────────────
// Sugerimos (lastBalance − prestacaoMensal) como saldo restante
// pós-pagamento, mas o utilizador deve confirmar com o extrato
// bancário — juros fazem o valor real divergir.
export default function PaymentModal({ debt, mk, lastBalance, onSave, onClose }) {
  const [hy, hm] = mk.split('-').map(Number)
  const [valor, setValor] = useState(String(debt.prestacaoMensal))
  const suggested = Math.max(0, lastBalance - debt.prestacaoMensal)
  const [saldo, setSaldo] = useState(String(Math.round(suggested * 100) / 100))

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ valor: parseFloat(valor) || 0, saldoRestante: Math.max(0, parseFloat(saldo) || 0) })
  }

  return (
    <Modal onClose={onClose} width={360} style={{ padding: '28px 28px 24px' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
        <X size={18} />
      </button>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
        Registar pagamento
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {debt.nome} — {MONTHS[hm]} {hy} · saldo atual: {formatEuro(lastBalance, 0)}
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Valor pago (€)">
          <input style={inputStyle} type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} autoFocus required />
        </Field>
        <Field label="Saldo restante após pagamento (€)" hint="Consulta o extrato bancário para o valor exato">
          <input style={inputStyle} type="number" min="0" step="0.01" value={saldo} onChange={e => setSaldo(e.target.value)} required />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" style={{ background: '#22c55e', border: 'none', color: '#fff' }}>Confirmar</Button>
        </div>
      </form>
    </Modal>
  )
}
