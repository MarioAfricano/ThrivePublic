import { STOCK_TAX_RATE } from '../../utils/calc/stockCalc.js'

// ── Constantes partilhadas da página Ações & ETFs ────────────────
export const currentYear = new Date().getFullYear()
export const TAX_RATE = STOCK_TAX_RATE

// Paleta cíclica atribuída por holding (ordem determina cor).
export const HOLDING_COLORS = [
  '#60a5fa','#4ade80','#fbbf24','#f472b6','#a78bfa',
  '#fb7185','#34d399','#818cf8','#f59e0b','#e879f9',
  '#38bdf8','#a3e635','#fb923c','#c084fc','#22d3ee',
]
