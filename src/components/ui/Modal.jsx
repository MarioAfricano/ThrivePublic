import { useEffect, useRef } from 'react'

/**
 * Modal — overlay com backdrop, Esc para fechar e gestão de foco.
 *
 * Props
 * ─────
 *   onClose    — callback ao fechar (Esc ou clique no backdrop).
 *   width      — largura da caixa (default: 440).
 *   title      — texto do cabeçalho (opcional).
 *   footer     — elemento React no rodapé (opcional; tipicamente botões).
 *   noBackdropClose — desactiva o fecho ao clicar fora.
 *   style      — override de estilos da caixa.
 *   children
 */
export function Modal({ onClose, width = 440, title, footer, noBackdropClose = false, style, children }) {
  const boxRef = useRef(null)

  // Foco inicial na caixa para capturar Esc
  useEffect(() => {
    const prev = document.activeElement
    boxRef.current?.focus()
    return () => prev?.focus()
  }, [])

  // Fechar com Esc
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleBackdrop(e) {
    if (!noBackdropClose && e.target === e.currentTarget) onClose()
  }

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.72)',
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <div
        ref={boxRef}
        tabIndex={-1}
        style={{
          position:     'relative',
          background:   'var(--bg-elevated)',
          border:       '1px solid var(--border-strong)',
          borderRadius: 16,
          padding:      28,
          width,
          maxWidth:     '92vw',
          maxHeight:    '90vh',
          overflowY:    'auto',
          outline:      'none',
          ...style,
        }}
      >
        {title && (
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
            {title}
          </h3>
        )}
        {children}
        {footer && (
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
