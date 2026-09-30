import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2, Save, Undo2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const isElectron = typeof window !== 'undefined' && !!window.api

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const [saving, setSaving] = useState(false)
  const { isDirty, persistData, history, undoLast } = useApp()
  const canUndo = history?.length > 0

  async function handleSave() {
    setSaving(true)
    await persistData()
    setSaving(false)
  }

  function handleClose() {
    if (isDirty) {
      const ok = window.confirm('Tens alterações sem checkpoint.\nCriar backup antes de fechar?')
      if (ok) persistData().then(() => window.api?.close())
      else window.api?.close()
    } else {
      window.api?.close()
    }
  }

  useEffect(() => {
    if (!isElectron) return
    window.api.isMaximized().then(setMaximized)
    window.api.onWindowStateChange((state) => setMaximized(state.maximized))
  }, [])

  // Ctrl+Z (undo) + Ctrl+S (save checkpoint)
  useEffect(() => {
    function onKey(e) {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undoLast?.() }
      if (e.key === 's') { e.preventDefault(); if (isDirty) handleSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoLast, isDirty]) // eslint-disable-line react-hooks/exhaustive-deps -- handleSave stable when isDirty is in deps

  return (
    <div
      className="drag-region"
      style={{
        height: 40,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px 0 20px',
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      {/* Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          T
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
          Thrive Finance
        </span>
      </div>

      {/* Botões de acção */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Undo */}
        <button onClick={undoLast} disabled={!canUndo}
          title={canUndo ? `Desfazer: ${history[history.length - 1]?.label} (Ctrl+Z)` : 'Sem alterações para desfazer'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 6, border: 'none',
            cursor: canUndo ? 'pointer' : 'default',
            background: 'transparent',
            color: canUndo ? 'var(--text-muted)' : 'var(--wa-15)',
            fontSize: '0.72rem', transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { if (canUndo) { e.currentTarget.style.background = 'var(--wa-06)'; e.currentTarget.style.color = 'var(--text)' }}}
          onMouseLeave={e => { if (canUndo) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}}>
          <Undo2 size={11} strokeWidth={2} />
        </button>
      </div>

      {/* Botão Guardar */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isDirty && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} title="Alterações por guardar" />
        )}
        <button onClick={handleSave} disabled={saving}
          title={isDirty ? 'Guardar checkpoint' : 'Sem alterações'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 6, border: 'none', cursor: isDirty ? 'pointer' : 'default',
            background: isDirty ? 'rgba(129,140,248,0.15)' : 'transparent',
            color: isDirty ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.72rem', fontWeight: isDirty ? 600 : 400,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { if (isDirty) e.currentTarget.style.background = 'rgba(129,140,248,0.25)' }}
          onMouseLeave={e => { if (isDirty) e.currentTarget.style.background = 'rgba(129,140,248,0.15)' }}>
          <Save size={11} strokeWidth={2} />
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>

      {/* Window Controls */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {[
          { icon: Minus,    action: () => window.api?.minimize(), label: 'Minimizar',   hoverColor: 'var(--wa-08)' },
          { icon: maximized ? Square : Maximize2, action: () => window.api?.maximize(), label: 'Maximizar', hoverColor: 'var(--wa-08)' },
          { icon: X,        action: handleClose,                   label: 'Fechar',      hoverColor: 'rgba(239,68,68,0.8)'    },
        ].map(({ icon: Icon, action, label, hoverColor }, i) => (
          <button
            key={i}
            onClick={isElectron ? action : undefined}
            title={label}
            aria-label={label}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = hoverColor
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <Icon size={12} strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  )
}
