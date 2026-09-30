// ── Constantes partilhadas da página Bancos ────────────────────
// Usadas pelos subcomponentes em src/components/banks/ e pela
// orquestração em src/pages/Banks.jsx.

// Tipos de conta suportados.
//   conta              — conta à ordem, sem juros
//   poupanca           — poupança com juros brutos (IRS pago depois)
//   poupanca_desconto  — poupança com retenção na fonte (IRS já descontado)
export const ACCOUNT_TYPES = {
  conta:             { label: 'Conta',         color: '#60a5fa', desc: 'Conta normal, sem juros' },
  poupanca:          { label: 'Poupança',       color: '#4ade80', desc: 'Poupança — juros chegam na totalidade' },
  poupanca_desconto: { label: 'P. c/ Desconto', color: '#fbbf24', desc: 'Poupança com retenção na fonte (IRS descontado antes de chegar)' },
}

// Paleta de cores para plataformas (modal "Nova plataforma").
export const PALETTE = [
  '#60a5fa','#818cf8','#a78bfa','#e879f9','#f472b6','#fb7185',
  '#f97316','#fbbf24','#facc15','#a3e635','#4ade80','#34d399',
  '#2dd4bf','#22d3ee','#38bdf8','#6366f1','#8b5cf6','#ec4899',
  '#14b8a6','#10b981','#d946ef','#f43f5e','#84cc16','#06b6d4',
]
