// ── Wrapper de modal ──────────────────────────────────────────────
// Overlay escuro + caixa central. Fecha ao clicar no backdrop.
// Usado por todos os modais da página Crypto.
export default function Modal({ children, onClose, width = 420 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 28, width, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}
