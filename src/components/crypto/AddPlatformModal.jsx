import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { S, PLATFORM_SUGGESTIONS } from './constants.js'

// ── Modal: Nova plataforma ────────────────────────────────────────
// Um campo de texto com chips sugestivos. Enter confirma, Escape fecha.
export default function AddPlatformModal({ onAdd, onClose }) {
  const [name, setName] = useState('')
  const valid = name.trim().length > 0

  return (
    <Modal onClose={onClose} width={380}>
      <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Nova Plataforma</h3>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Nome</label>
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && valid) { onAdd(name.trim()); onClose() }
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Ex: Binance" style={{ ...S.input, marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {PLATFORM_SUGGESTIONS.map(s => (
          <button key={s} onClick={() => setName(s)} style={{
            background: name === s ? 'rgba(245,158,11,0.15)' : 'var(--bg)',
            border: `1px solid ${name === s ? '#f59e0b' : 'var(--border)'}`,
            borderRadius: 20, color: name === s ? '#f59e0b' : 'var(--text-secondary)',
            padding: '3px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: name === s ? 600 : 400,
          }}>{s}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} onClick={() => { onAdd(name.trim()); onClose() }}
          style={{ background: '#f59e0b', border: 'none', color: '#000' }}>
          Adicionar
        </Button>
      </div>
    </Modal>
  )
}
