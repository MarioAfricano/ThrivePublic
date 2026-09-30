import { holdingQty, holdingTaxBreakdown } from '../../utils/calc/cryptoCalc.js'
import { badge } from './utils.js'

// ── Badge de estado IRS ──────────────────────────────────────────
// Três estados: ISENTO (todos os lots ≥ 1 ano), PARCIAL (mistura) ou
// IRS 28% (todos os lots < 1 ano). Invisível se a posição é 0.
export default function IRSBadge({ h }) {
  const qty = holdingQty(h)
  if (qty === 0) return null
  const bd = holdingTaxBreakdown(h)
  if (bd.isFullyExempt)
    return <span style={badge('#4ade80', 'rgba(74,222,128,0.15)', 'rgba(74,222,128,0.3)')}>ISENTO</span>
  if (bd.hasMixed)
    return <span style={badge('#fb923c', 'rgba(251,146,60,0.15)', 'rgba(251,146,60,0.3)')}>PARCIAL</span>
  return <span style={badge('#fbbf24', 'rgba(251,191,36,0.15)', 'rgba(251,191,36,0.3)')}>IRS 28%</span>
}
