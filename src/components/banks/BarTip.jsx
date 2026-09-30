import { formatEuro } from '../../data/initialData.js'

// ── Tooltip para o gráfico de barras da plataforma ─────────────
// Renderiza apenas o primeiro payload com label + valor em EUR.
export default function BarTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="label">{label}</p>
      <p className="value">{formatEuro(payload[0].value)}</p>
    </div>
  )
}
