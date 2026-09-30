// ── Camada de cálculos pura — Crypto ───────────────────────────────
// Invariantes:
//   - IRS 28% sobre ganhos de lots detidos < 1 ano. Lots com ≥ 365 dias são isentos (regime PT).
//   - Vendas usam FIFO: o lote mais antigo por buyDate é consumido primeiro.
//   - Custo médio por lote: unitCost = lot.gasto / lot.qty. Ao consumir `used` unidades,
//     o custo realizado é `used * unitCost`, e o lot remanescente fica `qty: qty-used, gasto: gasto-costUsed`.
//   - Mês-a-mês: a data de compra determina em que mk o lote passa a contar. `buyDate` no dia 1 conta
//     nesse mês; a partir do dia 2, só conta no mês seguinte (mesma regra dos bolsos de Ações).
//
// Todas as funções são puras. `nowMs` é injectável para testes de data.

import { getMK, compareMK } from '../dateUtils.js'

export const CRYPTO_IRS_RATE = 0.28
export const CRYPTO_TAX_FREE_DAYS = 365

// ── Data helpers ────────────────────────────────────────────────────
export function daysSince(dateStr, nowMs = Date.now()) {
  if (!dateStr) return 0
  return Math.floor((nowMs - new Date(dateStr).getTime()) / 86400000)
}
export function isLotExempt(lot, nowMs = Date.now()) {
  return daysSince(lot?.buyDate, nowMs) >= CRYPTO_TAX_FREE_DAYS
}
export function daysUntilExempt(lot, nowMs = Date.now()) {
  return Math.max(0, CRYPTO_TAX_FREE_DAYS - daysSince(lot?.buyDate, nowMs))
}

// ── Totais sem awareness de mês ─────────────────────────────────────
export function holdingQty(h)    { return (h?.lots || []).reduce((s, l) => s + (l.qty   || 0), 0) }
export function holdingGasto(h)  { return (h?.lots || []).reduce((s, l) => s + (l.gasto || 0), 0) }
export function holdingValue(h)  { return holdingQty(h) * (h?.price ?? 0) }
export function holdingProfit(h) { return holdingValue(h) - holdingGasto(h) }

/**
 * Breakdown fiscal de um holding (a live price).
 * Separa qty/gasto/valor em isento (≥ 1 ano) vs. tributável (< 1 ano).
 * taxDue aplica IRS apenas ao ganho tributável > 0 (perdas não geram imposto).
 */
export function holdingTaxBreakdown(h, nowMs = Date.now()) {
  const price = h?.price ?? 0
  let exemptQty = 0, exemptGasto = 0, taxableQty = 0, taxableGasto = 0
  for (const lot of (h?.lots || [])) {
    if (isLotExempt(lot, nowMs)) { exemptQty += lot.qty || 0; exemptGasto += lot.gasto || 0 }
    else                          { taxableQty += lot.qty || 0; taxableGasto += lot.gasto || 0 }
  }
  const taxableValue = taxableQty * price
  const taxableGain  = taxableValue - taxableGasto
  const taxDue       = taxableGain > 0 ? taxableGain * CRYPTO_IRS_RATE : 0
  return {
    exemptQty, exemptGasto, exemptValue: exemptQty * price,
    taxableQty, taxableGasto, taxableValue, taxableGain, taxDue,
    isFullyExempt:  taxableQty === 0 && exemptQty > 0,
    isFullyTaxable: exemptQty === 0,
    hasMixed:       exemptQty > 0 && taxableQty > 0,
  }
}

// ── FIFO helpers ────────────────────────────────────────────────────
function sortByBuyDateAsc(lots) {
  return [...(lots || [])].sort((a, b) => {
    if (!a.buyDate && !b.buyDate) return 0
    if (!a.buyDate) return 1
    if (!b.buyDate) return -1
    return new Date(a.buyDate) - new Date(b.buyDate)
  })
}

/**
 * Simulação de venda FIFO (não muta o holding).
 * Consome lotes por ordem crescente de buyDate.
 * Um lote isento (≥ 1 ano) acumula em exemptGain; lotes tributáveis acumulam em taxableGain
 * mas apenas quando gain > 0 (regime PT: perdas em ativos tributáveis não reduzem imposto aqui).
 */
export function simulateSale(h, sellQty, sellPrice, nowMs = Date.now()) {
  if (!sellQty || sellQty <= 0 || !sellPrice || sellPrice <= 0) return null
  const sorted = sortByBuyDateAsc(h?.lots || [])
  let remaining = sellQty, exemptGain = 0, taxableGain = 0, totalCost = 0
  for (const lot of sorted) {
    if (remaining <= 0) break
    const used = Math.min(remaining, lot.qty || 0)
    const avgUnit = (lot.gasto || 0) / (lot.qty || 1)
    const cost = used * avgUnit
    const gain = used * sellPrice - cost
    totalCost += cost
    if (isLotExempt(lot, nowMs)) exemptGain += gain
    else if (gain > 0) taxableGain += gain
    remaining -= used
  }
  const totalProceeds = sellQty * sellPrice
  return {
    totalProceeds,
    totalCost,
    totalGain: totalProceeds - totalCost,
    exemptGain,
    taxableGain,
    taxDue: taxableGain * CRYPTO_IRS_RATE,
  }
}

/**
 * Executa a venda FIFO e devolve os novos lots (os consumidos são eliminados;
 * o lote parcialmente consumido fica com qty/gasto reduzidos).
 * Lotes posteriores mantêm-se intactos.
 */
export function executeSale(h, sellQty, sellPrice) {
  const sorted = sortByBuyDateAsc(h?.lots || [])
  let remaining = sellQty
  const newLots = []
  let realizedGain = 0
  let realizedCost = 0

  for (const lot of sorted) {
    if (remaining <= 0) { newLots.push(lot); continue }
    const available = lot.qty || 0
    const used = Math.min(remaining, available)
    const unitCost = (lot.gasto || 0) / (available || 1)
    const cost = used * unitCost
    realizedGain += used * sellPrice - cost
    realizedCost += cost
    remaining -= used
    if (used < available) {
      newLots.push({ ...lot, qty: available - used, gasto: (lot.gasto || 0) - cost })
    }
    // used === available → lote totalmente consumido, não se adiciona a newLots
  }
  return { newLots, realizedGain, realizedCost, realizedProceeds: sellQty * sellPrice }
}

// ── Month-aware helpers ─────────────────────────────────────────────
/**
 * mk a partir do qual o lote começa a contar.
 * Regra: dia 1 conta no próprio mês; a partir do dia 2 conta no mês seguinte.
 */
export function lotMK(lot) {
  if (!lot?.buyDate) return null
  const d = new Date(lot.buyDate)
  if (d.getDate() > 1) d.setMonth(d.getMonth() + 1)
  return getMK(d.getFullYear(), d.getMonth())
}

export function lotExistsAtMk(lot, mk) {
  const lmk = lotMK(lot)
  return !lmk || compareMK(lmk, mk) <= 0
}

export function holdingPriceAtMk(h, mk) { return h?.monthData?.[mk]?.price ?? h?.price ?? 0 }
export function holdingQtyAtMk(h, mk) {
  return (h?.lots || []).filter(l => lotExistsAtMk(l, mk)).reduce((s, l) => s + (l.qty || 0), 0)
}
export function holdingGastoAtMk(h, mk) {
  return (h?.lots || []).filter(l => lotExistsAtMk(l, mk)).reduce((s, l) => s + (l.gasto || 0), 0)
}
export function holdingValueAtMk(h, mk)  { return holdingQtyAtMk(h, mk) * holdingPriceAtMk(h, mk) }
export function holdingProfitAtMk(h, mk) { return holdingValueAtMk(h, mk) - holdingGastoAtMk(h, mk) }

/**
 * Valor total da categoria cripto (suporta formato antigo {total} e novo {platforms}).
 * Se `mk` é fornecido: usa preço histórico (monthData[mk].price) e só considera
 * lotes existentes até esse mês (regra dos dias via lotMK).
 */
export function calcCryptoTotal(crypto, mk) {
  if (!crypto || typeof crypto !== 'object') return 0
  if (Array.isArray(crypto.platforms)) {
    return crypto.platforms.reduce((sum, p) =>
      sum + (Array.isArray(p.holdings) ? p.holdings : []).reduce((s, h) => {
        const lots = Array.isArray(h.lots) ? h.lots : []
        const activeLots = mk ? lots.filter(l => lotExistsAtMk(l, mk)) : lots
        const qty   = activeLots.reduce((q, l) => q + (l.qty || 0), 0)
        const price = (mk && h.monthData?.[mk]?.price != null) ? h.monthData[mk].price : (h.price || 0)
        return s + qty * price
      }, 0), 0)
  }
  return crypto.total || 0
}
