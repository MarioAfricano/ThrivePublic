// ── Wrapper para campos de formulário ────────────────────────────
// Label uppercase pequena + children + hint opcional abaixo.
export default function Field({ label, children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{hint}</span>}
    </div>
  )
}
