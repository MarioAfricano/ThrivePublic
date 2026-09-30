import { useState, useEffect } from 'react'
import { toastBus } from '../utils/toastBus.js'

// Banner que aparece brevemente no fundo do ecrã quando há um erro de rede.
// Subscreve o toastBus e auto-fecha após 5 segundos.
export default function NetworkToast() {
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    return toastBus.subscribe(m => {
      setMsg(m)
      const t = setTimeout(() => setMsg(null), 5000)
      return () => clearTimeout(t)
    })
  }, [])

  if (!msg) return null

  return (
    <div style={{
      position:  'fixed',
      bottom:    24,
      left:      '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-card)',
      border:     '1px solid #3f3f46',
      borderRadius: 8,
      padding:   '10px 14px',
      color:     '#a1a1aa',
      fontSize:  '0.8125rem',
      display:   'flex',
      alignItems: 'center',
      gap:        8,
      boxShadow: '0 4px 24px rgba(0,0,0,.6)',
      zIndex:    9999,
      maxWidth:  400,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: '0.9rem', color: '#facc15' }}>⚠</span>
      {msg}
      <button
        onClick={() => setMsg(null)}
        style={{
          background: 'none', border: 'none', color: '#52525b',
          cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
          padding: 0, marginLeft: 4,
        }}
        aria-label="Fechar"
      >×</button>
    </div>
  )
}
