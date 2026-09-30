import { MONTHS_SHORT, mkToNum, holdingQtyAtMk } from '../../data/initialData.js'

// ── Constantes ────────────────────────────────────────────────────
// IRS sobre mais-valias de ações/ETFs em PT: 28%. Ver `docs/financial-
// invariants.md` §4 para o tratamento das perdas.
export const TAX_RATE = 0.28

// ── Helpers partilhados pela Carteira ─────────────────────────────

// Cor para lucro/perda com dead-zone de ±0.5% para esconder ruído.
export function profitColor(v) {
  if (v > 0.005)  return 'var(--green)'
  if (v < -0.005) return 'var(--red)'
  return 'var(--text-muted)'
}

// Formato "Jan 2025" a partir de um mk "YYYY-M".
export function mkLabel(mk) {
  if (!mk) return '—'
  const [y, m] = mk.split('-').map(Number)
  return `${MONTHS_SHORT[m]} ${y}`
}

// Recebido total de uma posição vendida: soma sell-lots parciais +
// venda final (prefere `sellTotal` override, senão preço × qtd).
export function calcRecebido(h) {
  const sellLotsTotal = (h.lots || []).filter(l => l.isSell).reduce((s, l) => s + (l.sellTotal ?? 0), 0)
  const finalSale = h.sellTotal != null ? h.sellTotal : (h.sellPrice ?? 0) * (h.sellQty ?? holdingQtyAtMk(h, h.sellMk))
  return sellLotsTotal + finalSale
}

// mk mais antigo de compra — usa o campo `buyMk` (legado) ou o menor
// `buyMk` de entre os lots.
export function earliestBuyMk(h) {
  if (!h.lots?.length) return h.buyMk || null
  return h.lots.reduce((m, l) => (!m || (l.buyMk && mkToNum(l.buyMk) < mkToNum(m))) ? l.buyMk : m, null)
}
