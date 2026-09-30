// ── KPI Card ──────────────────────────────────────────────────
// Cartão compacto: ícone + label em caixa alta, valor grande e um
// subtítulo opcional com cor condicional (verde/vermelho/mudo) via
// `subUp` (true/false/undefined).
// O ícone é decorativo (o `label` já diz o que a métrica é), por isso
// vai embrulhado em aria-hidden.
export default function KPICard({ icon, label, value, sub, subUp }) {
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span aria-hidden="true" style={{ display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</p>
      {sub && (
        <p style={{ fontSize: '0.7rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums',
          color: subUp === undefined ? 'var(--text-muted)' : subUp ? 'var(--green)' : 'var(--red)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
