import { formatEuro } from '../../data/initialData.js'

// ── Tooltip do mini BarChart da SavingsSection ─────────────────
// Separa "Certo" de "Arriscado" e mostra o total somado.
export default function SavingsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const certo    = payload.find(p => p.dataKey === 'certo')?.value  || 0
  const arrisado = payload.find(p => p.dataKey === 'arrisado')?.value || 0
  return (
    <div className="custom-tooltip">
      <p className="label" style={{ marginBottom: 5 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <p style={{ color: '#818cf8', fontSize: '0.78rem' }}>Certo: {formatEuro(certo)}</p>
        <p style={{ color: '#4ade80', fontSize: '0.78rem' }}>Arriscado: {formatEuro(arrisado)}</p>
        <p style={{ color: 'var(--text)', fontSize: '0.8rem', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 2 }}>
          Total: {formatEuro(certo + arrisado)}
        </p>
      </div>
    </div>
  )
}
