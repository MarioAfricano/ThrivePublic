import { useState } from 'react'

// ── Botão de confirmação para acções perigosas ─────────────────
// Primeiro clique mostra "Tens a certeza? Sim/Não"; só o "Sim" dispara
// `onConfirm`. Usado nos resets de juros do 4º card de Bancos.
export default function ConfirmBtn({ label, onConfirm, icon: Icon, danger = true }) {
  const [step, setStep] = useState(0)
  if (step === 1) return (
    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--red)' }}>Tens a certeza?</span>
      <button onClick={() => { onConfirm(); setStep(0) }}
        style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid var(--red)', background: 'rgba(239,68,68,0.12)', color: 'var(--red)', fontSize: '0.7rem', cursor: 'pointer' }}>Sim</button>
      <button onClick={() => setStep(0)}
        style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer' }}>Não</button>
    </span>
  )
  return (
    <button onClick={() => setStep(1)}
      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: danger ? 'var(--text-muted)' : 'var(--text-muted)', fontSize: '0.72rem', padding: '3px 0' }}
      onMouseEnter={e => e.currentTarget.style.color = danger ? 'var(--red)' : 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
      {Icon && <Icon size={11} />}{label}
    </button>
  )
}
