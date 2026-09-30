// ── Benchmark justo (money-weighted) ───────────────────────────────
// Simula os MESMOS fluxos da carteira (compras, vendas, dividendos)
// aplicados ao benchmark: cada investimento compra unidades ao preço do
// mês, cada levantamento vende o mesmo montante em €. O resultado é o
// valor final e o XIRR que o índice teria dado com as tuas datas —
// comparável 1:1 com o teu XIRR real.
//
// Limitações (avisadas na UI): preços mensais (dia 15 por convenção) e
// sem efeito cambial (SPY cotado em USD tratado ao par com fluxos EUR).

import { xirr, holdingCashflows } from './xirrCalc.js'

// Último preço mensal <= data. points: [{ year, month, price }] (0-indexed).
export function priceAtDate(points, dateMs) {
  if (!points?.length) return null
  const d = new Date(dateMs)
  const target = d.getFullYear() * 12 + d.getMonth()
  let best = null
  for (const p of points) {
    const idx = p.year * 12 + p.month
    if (idx <= target && (best == null || idx > best.idx)) best = { price: p.price, idx }
  }
  return best?.price ?? null
}

// Aplica os fluxos ao benchmark. Devolve { finalValue, units } ou null
// se faltar preço para alguma data (histórico não cobre o período).
export function simulateFlowsOnBenchmark(flows, points, now = Date.now()) {
  let units = 0
  for (const f of flows) {
    const price = priceAtDate(points, f.date)
    if (!price) return null
    units += (-f.amount) / price // investimento (amount<0) compra; levantamento vende
  }
  const lastPrice = priceAtDate(points, now)
  if (!lastPrice) return null
  return { finalValue: units * lastPrice, units }
}

// XIRR do benchmark com os fluxos da carteira (sem o valor de mercado
// actual — as posições activas "continuam investidas" no índice).
export function benchmarkXirr(holdings, points, now = Date.now()) {
  const flows = (holdings || []).flatMap(h => holdingCashflows(h, { currentValue: 0, now }))
  if (!flows.length) return null
  const sim = simulateFlowsOnBenchmark(flows, points, now)
  if (!sim || !(sim.finalValue > 0)) return null
  const rate = xirr([...flows, { amount: sim.finalValue, date: now }])
  if (rate == null) return null
  const invested = flows.filter(f => f.amount < 0).reduce((s, f) => s - f.amount, 0)
  return { rate, finalValue: sim.finalValue, invested }
}
