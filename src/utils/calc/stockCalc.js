// ── Camada de cálculos pura — Ações & ETFs ─────────────────────────
// Invariantes:
//   - mk = "YYYY-M" com M 0-indexed. Comparar SEMPRE via mkToNum.
//   - moeda base: EUR. A conversão live/frozen é feita fora (toEUR).
//   - lots são a fonte de verdade para quantidade/gasto quando existem; se não houver lots
//     caímos para h.qty / h.gasto de raiz (compatibilidade com formatos antigos).
//   - Venda parcial: representada por lot com `isSell: true`, qty positivo (mesmo sendo venda),
//     `sellTotal` (proceeds), e `buyMk` a indicar o mês em que a venda foi efectuada.
//   - Regra dos dias para entregas de bolsos: entregas no dia 1 contam para esse mês; depois do dia 1 só a partir do mês seguinte.
//
// Este módulo só contém funções puras — sem acesso a state, sem React.

import { mkToNum, getMK } from '../dateUtils.js'

// ── Helpers de quantidade/gasto/visibilidade (fonte de verdade) ──────
// Note: "mk" aqui é string "YYYY-M" (0-indexed para mês), como usado
// em toda a app. buyMk 1-indexed foi o formato antigo — usamos as datas
// ISO dos lots (buyDate) quando existem via wrappers externos.

/** mk mais antigo de um holding (menor buyMk dos lots, ou h.buyMk). */
export function holdingEarliestBuyMk(h) {
  if (h?.lots?.length) {
    return h.lots.reduce((min, l) => {
      if (!l.buyMk) return min
      if (!min || mkToNum(l.buyMk) < mkToNum(min)) return l.buyMk
      return min
    }, h.buyMk || null)
  }
  return h?.buyMk || null
}

/**
 * Quantidade total no mês mk.
 * Regra: compras só contam a partir do mês seguinte (< cur); vendas contam logo no próprio mês (<= cur).
 * Sem lots: fallback para h.qty.
 */
export function holdingQtyAtMk(h, mk) {
  if (h?.lots?.length) {
    if (!mk) return h.lots.reduce((s, l) => s + (l.qty || 0), 0)
    const cur = mkToNum(mk)
    return h.lots
      .filter(l => !l.buyMk || (l.isSell ? mkToNum(l.buyMk) <= cur : mkToNum(l.buyMk) < cur))
      .reduce((s, l) => s + (l.qty || 0), 0)
  }
  return h?.qty || 0
}

/**
 * Gasto total no mês mk (só lots de compra, vendas não afectam custo).
 * Regra: compras só contam a partir do mês seguinte (< cur).
 * Sem lots: fallback para h.gasto.
 */
export function holdingGastoAtMk(h, mk) {
  if (h?.lots?.length) {
    if (!mk) return h.lots.filter(l => !l.isSell).reduce((s, l) => s + (l.gasto || 0), 0)
    const cur = mkToNum(mk)
    return h.lots
      .filter(l => !l.isSell && (!l.buyMk || mkToNum(l.buyMk) < cur))
      .reduce((s, l) => s + (l.gasto || 0), 0)
  }
  return h?.gasto || 0
}

/** Holding activo no mês mk? Respeita sellMk (venda total) e sell lots (venda parcial). */
export function holdingActiveInMk(h, mk) {
  if (!mk) {
    if (h?.sellMk) return false
    if (h?.lots?.some(l => l.isSell)) return holdingQtyAtMk(h, null) > 0.00001
    return true
  }
  const cur = mkToNum(mk)
  const buyMk = holdingEarliestBuyMk(h)
  if (buyMk && mkToNum(buyMk) >= cur) return false
  if (h?.sellMk && mkToNum(h.sellMk) < cur) return false
  if (h?.lots?.some(l => l.isSell && l.buyMk && mkToNum(l.buyMk) <= cur)) {
    return holdingQtyAtMk(h, mk) > 0.00001
  }
  return true
}

/**
 * Câmbio → EUR de um holding num mês.
 * Prioridade: taxa congelada no snapshot (monthData[mk].rateToEUR) >
 * taxa live (liveRates) > 1.0. EUR devolve sempre 1.
 */
export function holdingRateToEUR(h, mk, liveRates) {
  const cur = h?.currency
  if (!cur || cur === 'EUR') return 1.0
  const frozen = mk ? h?.monthData?.[mk]?.rateToEUR : null
  return frozen ?? liveRates?.[cur] ?? 1.0
}

/**
 * Valor de um holding EM EUR (qty × price × câmbio), respeitando
 * monthData[mk] quando existe. Sem `liveRates` e sem taxa congelada,
 * holdings não-EUR assumem 1.0 (comportamento antigo).
 */
export function calcHoldingValue(h, mk, liveRates) {
  if (mk && !holdingActiveInMk(h, mk)) return 0
  const fx = holdingRateToEUR(h, mk, liveRates)
  if (mk && h?.monthData?.[mk]) {
    const md = h.monthData[mk]
    const qty = h.lots?.length ? holdingQtyAtMk(h, mk) : (md.qty ?? holdingQtyAtMk(h, mk))
    return qty * (md.price ?? h.price ?? 0) * fx
  }
  return holdingQtyAtMk(h, mk) * (h?.price || 0) * fx
}

/** Soma de calcHoldingValue sobre uma lista (EUR). */
export function calcHoldingsTotal(holdings, mk, liveRates) {
  return (holdings || []).reduce((s, h) => s + calcHoldingValue(h, mk, liveRates), 0)
}

/** Dividendos de um holding para um ano (filtra por d.mk ou d.date). */
export function calcDividendsYear(h, year) {
  return (h?.dividends || []).filter(d => {
    if (d.mk) { const [y] = d.mk.split('-').map(Number); return y === year }
    if (d.date) return new Date(d.date).getFullYear() === year
    return false
  }).reduce((s, d) => s + (d.amount || 0), 0)
}

/** Soma de dividendos de uma lista de holdings para um ano. */
export function calcAllDividendsYear(holdings, year) {
  return (holdings || []).reduce((s, h) => s + calcDividendsYear(h, year), 0)
}

/** Total de bolsos (usa snapshot monthData[mk].valorAtual se existir). */
export function calcBolsosTotal(bolsos, mk) {
  return (bolsos || []).reduce((s, b) => {
    if (mk && b.monthData?.[mk]) return s + (b.monthData[mk].valorAtual || 0)
    return s + (b.valorAtual || 0)
  }, 0)
}

/**
 * Investido acumulado de um bolso até ao mês mk (inclusive).
 * Regra dos dias: entregas no dia 1 ou sem dia contam a partir desse mês;
 * entregas após o dia 1 só contam a partir do mês seguinte.
 * Fallback para bolso.valorInvestido quando não há entregas.
 */
export function bolsoInvestidoAtMk(bolso, mk) {
  const entregas = bolso?.entregas || []
  if (!entregas.length) return bolso?.valorInvestido || 0
  return entregas
    .filter(e => {
      if (!e.date || !mk) return true
      const [ey, em, ed] = e.date.split('-').map(Number) // em é 1-indexed
      const day = ed || 1
      if (day <= 1) {
        return mkToNum(getMK(ey, em - 1)) <= mkToNum(mk)
      } else {
        const nextM = em === 12 ? 0 : em            // em-1 + 1 = em (0-indexed)
        const nextY = em === 12 ? ey + 1 : ey
        return mkToNum(getMK(nextY, nextM)) <= mkToNum(mk)
      }
    })
    .reduce((s, e) => s + (e.amount || 0), 0)
}

/**
 * Custo médio ponderado + lucro realizado de vendas parciais.
 *
 * Sem sell lots → { adjustedGasto: holdingGastoAtMk(h, mk), realizedProfit: 0 }.
 * Com sell lots:
 *   - avgCost  = soma(gasto compras ≤ mk) / soma(qty compras ≤ mk)
 *   - realizedProfit = Σ (sellTotal_i - |qty_i| · avgCost) para cada sell lot ≤ mk
 *   - adjustedGasto = qty_restante_atual · avgCost
 * Nota: usa custo médio ponderado — NÃO é FIFO. Veja cryptoCalc para FIFO.
 */
export function holdingAdjustedStats(h, mk) {
  const hasSellLots = h?.lots?.some(l => l.isSell)
  if (!hasSellLots) return { adjustedGasto: holdingGastoAtMk(h, mk), realizedProfit: 0 }

  const cur = mk ? mkToNum(mk) : Infinity
  const buyLots = (h.lots || []).filter(l => !l.isSell && (!l.buyMk || mkToNum(l.buyMk) <= cur))
  const totalBoughtQty   = buyLots.reduce((s, l) => s + (l.qty   || 0), 0)
  const totalBoughtGasto = buyLots.reduce((s, l) => s + (l.gasto || 0), 0)
  const avgCost = totalBoughtQty > 0 ? totalBoughtGasto / totalBoughtQty : 0

  const sellLots = (h.lots || []).filter(l => l.isSell && (!l.buyMk || mkToNum(l.buyMk) <= cur))
  const realizedProfit = sellLots.reduce((s, l) => {
    const soldQty = Math.abs(l.qty || 0)
    return s + ((l.sellTotal ?? 0) - soldQty * avgCost)
  }, 0)

  const remainingQty = holdingQtyAtMk(h, mk)
  return { adjustedGasto: remainingQty * avgCost, realizedProfit }
}

/**
 * Gasto efectivo respeitando override manual por mês (gastoOverrideByMk).
 * Usa o override mais recente com mk ≤ cur. Se não houver override, devolve adjustedGasto.
 */
export function effectiveGasto(h, mk) {
  const overrides = h?.gastoOverrideByMk
  if (overrides && mk) {
    const cur = mkToNum(mk)
    const entries = Object.entries(overrides)
      .filter(([m]) => mkToNum(m) <= cur)
      .sort((a, b) => mkToNum(b[0]) - mkToNum(a[0]))
    if (entries.length > 0) return entries[0][1]
  }
  return holdingAdjustedStats(h, mk).adjustedGasto
}

/**
 * IRS estimado 28% sobre ganho líquido de uma venda (usado na UI como pré-visualização).
 * `netGain` é o lucro realizado (pode ser negativo).
 */
export const STOCK_TAX_RATE = 0.28
export function stockTaxDue(netGain) {
  return netGain > 0 ? netGain * STOCK_TAX_RATE : 0
}
