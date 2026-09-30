import { useState } from 'react'
import { PALETTE } from './constants.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

// ── Modal nova plataforma ──────────────────────────────────────
// Recolhe nome + cor (paleta ou hex livre) e dispara `onAdd`. A nova
// plataforma herda `startMK = mk`, portanto só aparece a partir deste mês.
export default function NewPlatformModal({ onAdd, onClose, mk }) {
  const [name,      setName]      = useState('')
  const [color,     setColor]     = useState('#818cf8')
  const [customHex, setCustomHex] = useState('')

  function submit() {
    if (!name.trim()) return
    onAdd({ id: Date.now().toString(), name: name.trim(), fullName: name.trim(), color, accounts: [], startMK: mk })
    onClose()
  }

  return (
    <Modal onClose={onClose} width={400} title="Nova Plataforma">
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Nome</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Montepio" autoFocus
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: '0.875rem', outline: 'none' }} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Cor</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => { setColor(c); setCustomHex('') }}
              style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cor personalizada:</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 32, height: 32, padding: 2, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
          <input value={customHex || color} onChange={e => { setCustomHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setColor(e.target.value) }}
            placeholder="#rrggbb"
            style={{ width: 90, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: '0.78rem', outline: 'none' }} />
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: color, border: '1px solid var(--wa-20)', flexShrink: 0 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
        <Button variant="primary" fullWidth onClick={submit}>Criar</Button>
      </div>
    </Modal>
  )
}
