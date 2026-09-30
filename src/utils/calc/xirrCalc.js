// ── XIRR: taxa interna de retorno anualizada com fluxos datados ────
// Responde a "qual foi o meu retorno anual real?" tendo em conta QUANDO
// cada euro entrou e saiu — ao contrário do lucro %, é comparável com
// o retorno anualizado de um índice.
//
// Invariantes:
//   - Fluxos: { amount, date } — amount em EUR (negativo = investimento,
//     positivo = venda/dividendo/valor actual), date em ms epoch.
//   - `xirr` devolve a taxa anual (0.07 = 7%/ano) ou null quando não é
//     calculável (fluxos insuficientes, sem mudança de sinal, span < 15 dias).
//   - Resolução por bissecção em [-99,99%, +1000%] — robusta, sem os
//     problemas de divergência do método de Newton.

import { holdingQtyAtMk } from './stockCalc.js'

const MS_YEAR = 365.25 * 24 * 3600 * 1000
const MIN_SPAN_MS = 15 * 24 * 3600 * 1000

// mk "YYYY-M" (0-indexed) → timestamp a meio do mês (dia 15)
export function mkToDate(mk, day = 15) {
  if (!mk) return null
  const [y, m] = String(mk).split('-').map(Number)
  if (isNaN(y) || isNaN(m)) return null
  return new Date(y, m, day).getTime()
}

// Valor actual líquido dos fluxos a uma dada taxa anual.
export function xnpv(rate, flows) {
  const t0 = flows[0].date
  return flows.reduce((s, f) => s + f.amount / Math.pow(1 + rate, (f.date - t0) / MS_YEAR), 0)
}

export function xirr(flows) {
  const valid = (flows || [])
    .filter(f => f && typeof f.amount === 'number' && f.amount !== 0 && f.date != null)
    .sort((a, b) => a.date - b.date)
  if (valid.length < 2) return null
  if (!valid.some(f => f.amount < 0) || !valid.some(f => f.amount > 0)) return null
  if (valid.at(-1).date - valid[0].date < MIN_SPAN_MS) return null

  let lo = -0.9999, hi = 10
  let fLo = xnpv(lo, valid)
  const fHi = xnpv(hi, valid)
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fMid = xnpv(mid, valid)
    if (!isFinite(fMid)) return null
    if (Math.abs(fMid) < 1e-9) return mid
    if (fLo * fMid < 0) hi = mid
    else { lo = mid; fLo = fMid }
  }
  return (lo + hi) / 2
}

// Fluxos de caixa de uma holding de ações/ETFs, em EUR:
//   compras (lots)      → −gasto no mês de compra
//   vendas parciais     → +sellTotal no mês da venda (sell lots)
//   dividendos          → +amount na data (ou mk)
//   venda final         → +recebido no sellMk
//   posição activa      → +currentValue hoje (valor de mercado)
export function holdingCashflows(h, { currentValue = 0, now = Date.now() } = {}) {
  const flows = []
  const lots = h?.lots || []
  if (lots.length) {
    for (const l of lots) {
      const d = mkToDate(l.buyMk) ?? mkToDate(h.buyMk) ?? now
      if (l.isSell) flows.push({ amount: l.sellTotal ?? 0, date: d })
      else          flows.push({ amount: -(l.gasto || 0), date: d })
    }
  } else if (h) {
    flows.push({ amount: -(h.gasto || 0), date: mkToDate(h.buyMk) ?? now })
  }
  for (const dv of (h?.dividends || [])) {
    const d = dv.date ? new Date(dv.date).getTime() : mkToDate(dv.mk)
    if (d != null && (dv.amount || 0) !== 0) flows.push({ amount: dv.amount, date: d })
  }
  if (h?.sellMk) {
    const qty   = h.sellQty ?? holdingQtyAtMk(h, h.sellMk)
    const final = h.sellTotal != null ? h.sellTotal : (h.sellPrice ?? 0) * qty
    if (final) flows.push({ amount: final, date: mkToDate(h.sellMk) ?? now })
  } else if (currentValue > 0) {
    flows.push({ amount: currentValue, date: now })
  }
  return flows.filter(f => f.date != null && f.amount !== 0)
}

// XIRR agregado de um conjunto de holdings. `valueOf(h)` devolve o valor
// de mercado actual (EUR) de uma posição activa.
export function portfolioXirr(holdings, valueOf, now = Date.now()) {
  const flows = (holdings || []).flatMap(h =>
    holdingCashflows(h, { currentValue: h.sellMk ? 0 : (valueOf?.(h) || 0), now }))
  return xirr(flows)
}
