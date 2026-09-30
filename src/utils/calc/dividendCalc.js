// ── Dividendos: calendário e yield-on-cost ─────────────────────────
// Agrega os dividendos registados nas holdings (ações + ETFs) por mês
// e por posição. Cada dividendo: { mk?, date?, amount } — o mês vem do
// mk ("YYYY-M", 0-indexed) ou da date.

import { holdingGastoAtMk } from './stockCalc.js'

// Devolve { y, m } de um dividendo, ou null se não tiver data.
export function dividendYM(d) {
  if (d?.mk) {
    const [y, m] = String(d.mk).split('-').map(Number)
    if (!isNaN(y) && !isNaN(m)) return { y, m }
  }
  if (d?.date) {
    const dt = new Date(d.date)
    if (!isNaN(dt)) return { y: dt.getFullYear(), m: dt.getMonth() }
  }
  return null
}

// Totais por mês (array de 12) para um ano civil.
export function dividendsByMonth(holdings, year) {
  const byMonth = Array(12).fill(0)
  for (const h of holdings || []) {
    for (const d of h.dividends || []) {
      const ym = dividendYM(d)
      if (ym?.y === year) byMonth[ym.m] += d.amount || 0
    }
  }
  return byMonth
}

// Total dos últimos `months` meses terminando em (endY, endM) inclusive.
export function trailingDividends(holdings, endY, endM, months = 12) {
  const endIdx   = endY * 12 + endM
  const startIdx = endIdx - months + 1
  let total = 0
  for (const h of holdings || []) {
    for (const d of h.dividends || []) {
      const ym = dividendYM(d)
      if (!ym) continue
      const idx = ym.y * 12 + ym.m
      if (idx >= startIdx && idx <= endIdx) total += d.amount || 0
    }
  }
  return total
}

// Totais por ano civil, ordenados: [{ year, total }] — evolução do
// rendimento passivo. Anos sem dividendos não aparecem.
export function dividendsByYear(holdings) {
  const byYear = {}
  for (const h of holdings || []) {
    for (const d of h.dividends || []) {
      const ym = dividendYM(d)
      if (ym) byYear[ym.y] = (byYear[ym.y] || 0) + (d.amount || 0)
    }
  }
  return Object.entries(byYear)
    .map(([y, total]) => ({ year: Number(y), total }))
    .filter(r => r.total > 0)
    .sort((a, b) => a.year - b.year)
}

// Resumo do ano: total, calendário mensal e posições pagadoras com
// yield-on-cost (dividendos do ano / custo total da posição).
export function dividendSummary(holdings, year) {
  const byMonth = dividendsByMonth(holdings, year)
  const total   = byMonth.reduce((s, v) => s + v, 0)
  const positions = (holdings || [])
    .map(h => {
      const divs = (h.dividends || []).reduce((s, d) => {
        const ym = dividendYM(d)
        return ym?.y === year ? s + (d.amount || 0) : s
      }, 0)
      if (divs <= 0) return null
      const gasto = holdingGastoAtMk(h, null)
      return { id: h.id, ticker: h.ticker || '—', name: h.name || '', total: divs, yoc: gasto > 0 ? divs / gasto : null }
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)
  return { total, byMonth, positions }
}
