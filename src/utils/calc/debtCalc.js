// ── Camada de cálculos pura — Dívidas ──────────────────────────────
// Modelo de dados:
//   debt = {
//     id, nome, montanteInicial, prestacaoMensal, inicioMK?,
//     pagamentos: { mk: [{ id, valor, saldoRestante }] }   // formato actual (array)
//                | { mk: { pago: true, valor, saldoRestante } }  // formato legacy (objecto)
//   }
// Não é uma tabela de amortização real — assume prestação linear (não distingue juro/capital).
// A lógica existe para prever o payoff assumindo que a ritmo actual se mantém.
//
// Invariantes:
//   - `currentBalance` = saldoRestante do último pagamento ≤ currentMK, ou montanteInicial se não há pagamentos.
//   - `monthlyRate` = média do total pago por mês (somando múltiplos pagamentos no mesmo mês).
//   - `monthsLeft` = ceil(currentBalance / monthlyRate). null se monthlyRate ≤ 0.
//   - O mês do payoff é calculado com aritmética 0-indexed (y*12 + m).

import { compareMK } from '../dateUtils.js'

/** Devolve o array de pagamentos de um mês, normalizando o formato legacy. */
export function getMonthPayments(debt, mk) {
  const entry = debt?.pagamentos?.[mk]
  if (!entry) return []
  if (Array.isArray(entry)) return entry
  if (entry.pago) return [{ id: 'legacy', valor: entry.valor || 0, saldoRestante: entry.saldoRestante || 0 }]
  return []
}

/** Lista global de pagamentos até currentMK (inclusive), ordenada por mk ascendente. */
export function getAllPayments(debt, currentMK) {
  const all = []
  Object.entries(debt?.pagamentos || {}).forEach(([m]) => {
    if (compareMK(m, currentMK) > 0) return
    getMonthPayments(debt, m).forEach(p => all.push({ mk: m, ...p }))
  })
  return all.sort((a, b) => compareMK(a.mk, b.mk))
}

/**
 * Projecção de payoff baseada no ritmo de pagamentos observado.
 * - currentBalance: último saldoRestante ≤ currentMK, ou montanteInicial.
 * - monthlyRate: média do total pago por mês (múltiplos pagamentos no mesmo mês somam-se).
 *   Fallback: debt.prestacaoMensal.
 * - monthsLeft: ceil(currentBalance / monthlyRate); null se monthlyRate ≤ 0.
 * - payoffYear/Month: mk do mês em que a dívida fecha (0-indexed para month).
 */
export function getDebtPayoff(debt, currentMK) {
  const allPaid = getAllPayments(debt, currentMK)

  const currentBalance = allPaid.length > 0
    ? allPaid[allPaid.length - 1].saldoRestante
    : (debt?.montanteInicial || 0)

  let monthlyRate = debt?.prestacaoMensal || 0
  if (allPaid.length >= 1) {
    const byMonth = {}
    allPaid.forEach(p => { byMonth[p.mk] = (byMonth[p.mk] || 0) + (p.valor || 0) })
    const totals = Object.values(byMonth)
    const avg = totals.reduce((s, v) => s + v, 0) / totals.length
    if (avg > 0) monthlyRate = avg
  }

  const monthsLeft = monthlyRate > 0 ? Math.ceil(currentBalance / monthlyRate) : null

  let payoffYear = null, payoffMonth = null
  if (monthsLeft !== null) {
    const [cy, cm] = currentMK.split('-').map(Number)
    const total = cy * 12 + cm + monthsLeft
    payoffYear  = Math.floor(total / 12)
    payoffMonth = total % 12
  }

  return { currentBalance, monthlyRate, monthsLeft, payoffYear, payoffMonth }
}

/**
 * Série anual de pontos {year, actual?, projected?} para o gráfico.
 * - actual: último saldoRestante do ano (se houve pagamento nesse ano); no primeiro ano sem pagamentos → montanteInicial.
 * - projected: saldo estimado no final do ano (currentBalance - monthlyRate × meses desde currentMK).
 * - para anos ≥ currentYear, projected é Max(0, ...).
 * - corta ao atingir projected=0.
 */
export function buildYearlyChart(debt, currentMK) {
  const { currentBalance, monthlyRate, payoffYear } = getDebtPayoff(debt, currentMK)
  const [cy, cm] = currentMK.split('-').map(Number)

  const allPaid = getAllPayments(debt, currentMK)

  const startYear = debt?.inicioMK
    ? Number(debt.inicioMK.split('-')[0])
    : (allPaid[0] ? Number(allPaid[0].mk.split('-')[0]) : cy)
  const endYear = payoffYear ? Math.min(payoffYear, cy + 50) : cy + 30

  const points = []
  for (let y = startYear; y <= endYear; y++) {
    const pt = { year: y }

    const yearPaid = allPaid.filter(p => {
      const [my] = p.mk.split('-').map(Number)
      return my === y
    })
    if (yearPaid.length > 0) {
      pt.actual = yearPaid[yearPaid.length - 1].saldoRestante
    } else if (y === startYear && allPaid.length === 0) {
      pt.actual = debt?.montanteInicial || 0
    }

    if (y >= cy && monthlyRate > 0) {
      const monthsFromNow = (y - cy) * 12 + (11 - cm)
      pt.projected = Math.max(0, Math.round(currentBalance - monthlyRate * monthsFromNow))
    }

    points.push(pt)
    if (pt.projected === 0) break
  }
  return points
}
