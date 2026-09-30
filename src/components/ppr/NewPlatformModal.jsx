import { useState } from 'react'
import { PALETTE } from './constants.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

// ── Modal: nova plataforma PPR ───────────────────────────────────
// Nome + cor (palette pré-definida ou color picker nativo).
// Plataforma criada sem contas — o utilizador adiciona depois.
export default function NewPlatformModal({ onAdd, onClose, mk }) {
  const [name,  setName]  = useState('')
  const [color, setColor] = useState('#f472b6')

  function submit() {
    if (!name.trim()) return
    onAdd({ id: Date.now().toString(), name: name.trim(), color, accounts: [], startMK: mk })
    onClose()
  }

  return (
    <Modal onClose={onClose} width={380} title="Nova Plataforma PPR">
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Nome</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Casa de Investimentos" autoFocus
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: '0.875rem', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Cor</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 32, height: 32, padding: 2, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, border: '1px solid var(--wa-20)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
        <Button variant="primary" fullWidth onClick={submit}>Criar</Button>
      </div>
    </Modal>
  )
}
