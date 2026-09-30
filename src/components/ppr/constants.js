// ── Paleta de cores para plataformas PPR ─────────────────────────
export const PALETTE = [
  '#60a5fa','#818cf8','#a78bfa','#e879f9','#f472b6','#fb7185',
  '#f97316','#fbbf24','#facc15','#a3e635','#4ade80','#34d399',
  '#2dd4bf','#22d3ee','#38bdf8','#6366f1','#8b5cf6','#ec4899',
  '#14b8a6','#10b981','#d946ef','#f43f5e','#84cc16','#06b6d4',
]

// ── Anos disponíveis no picker (2010 até ano actual + 2) ────────
const currentYear = new Date().getFullYear()
export const YEAR_OPTIONS = Array.from({ length: currentYear - 2009 + 2 }, (_, i) => 2010 + i)
