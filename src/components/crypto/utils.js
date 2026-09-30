import { formatEuro } from '../../data/initialData.js'

// ── Helpers visuais ───────────────────────────────────────────────

// Cor de ganho/perda com dead-zone para esconder flutuações de arredondamento.
export function profitColor(v) {
  if (v > 0.005) return 'var(--green)'
  if (v < -0.005) return '#ef4444'
  return 'var(--text-muted)'
}

// Formato de quantidade — casas decimais adaptativas consoante a magnitude.
export function fmtQty(qty) {
  if (qty == null) return '—'
  if (qty >= 1000) return qty.toLocaleString('pt-PT', { maximumFractionDigits: 2 })
  if (qty >= 1)    return qty.toLocaleString('pt-PT', { maximumFractionDigits: 4 })
  return qty.toLocaleString('pt-PT', { maximumFractionDigits: 8 })
}

// Preço em EUR. Usa 6 casas para tokens abaixo de 1€ (PEPE, SHIB, etc.).
export function fmtPrice(p) {
  if (p == null) return '—'
  return formatEuro(p, p >= 1 ? 2 : 6)
}

// Estilo de pastilha reutilizado em vários sítios (badge IRS, badge de isenção por lote).
export function badge(color, bg, border) {
  return {
    fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px',
    borderRadius: 20, background: bg, color, border: `1px solid ${border}`,
  }
}
