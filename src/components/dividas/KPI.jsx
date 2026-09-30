// ── Cartão KPI simples usado no resumo da página Dividas ─────────
export default function KPI({ label, value }) {
  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: '1.1rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
