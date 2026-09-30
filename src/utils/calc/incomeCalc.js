// ── Taxa de poupança mensal ────────────────────────────────────────
// O utilizador regista o rendimento líquido do mês (`data.income[mk]`);
// a "poupança" é a variação do património total entre snapshots
// consecutivos. Nota honesta: essa variação inclui valorização de
// mercado — a taxa é uma aproximação, não contabilidade de fluxos.

// Soma de um snapshot mensal ({ banco, poupanca, acoes, ... }).
export function snapTotal(snap) {
  if (!snap) return null
  return Object.values(snap).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
}

// Taxa de poupança de um mês: precisa de rendimento registado e de
// snapshots do próprio mês e do anterior. Devolve null se faltar algo.
export function savingsRateForMonth(years, income, y, m) {
  const inc = income?.[`${y}-${m}`]
  if (!inc || inc <= 0) return null
  const cur = snapTotal(years?.[y]?.months?.[m])
  const py = m === 0 ? y - 1 : y
  const pm = m === 0 ? 11 : m - 1
  const prev = snapTotal(years?.[py]?.months?.[pm])
  if (cur == null || prev == null) return null
  const delta = cur - prev
  return { income: inc, delta, rate: delta / inc }
}

// Fundo de emergência: meses de despesas cobertos pela liquidez
// (banco + poupança + aforro). null sem despesas definidas.
export function runwayMonths(liquidity, monthlyExpenses) {
  if (!monthlyExpenses || monthlyExpenses <= 0) return null
  return (liquidity || 0) / monthlyExpenses
}

// Poupança média mensal do ano: (total atual − baseline) ÷ meses decorridos.
// Baseline preferido: snapshot de dezembro do ano anterior (cobre jan..mês
// atual = m+1 meses); sem ele, o primeiro snapshot do próprio ano anterior
// ao mês atual (cobre m−m0 meses). Como o resto deste módulo, a variação
// inclui valorização de mercado — aproximação, não contabilidade de fluxos.
// Devolve { avg, months, baselineMK } ou null sem baseline utilizável.
export function avgMonthlySavings(years, liveTotal, y, m) {
  if (liveTotal == null) return null
  const dec = snapTotal(years?.[y - 1]?.months?.[11])
  if (dec != null && m + 1 > 0) {
    return { avg: (liveTotal - dec) / (m + 1), months: m + 1, baselineMK: `${y - 1}-11` }
  }
  for (let m0 = 0; m0 < m; m0++) {
    const s = snapTotal(years?.[y]?.months?.[m0])
    if (s != null) {
      return { avg: (liveTotal - s) / (m - m0), months: m - m0, baselineMK: `${y}-${m0}` }
    }
  }
  return null
}

// Agregado dos últimos `months` meses (terminando em endY/endM):
// taxa = Σ deltas / Σ rendimentos — mais estável do que a média das
// taxas mensais. Devolve null se nenhum mês tiver dados completos.
export function aggregateSavingsRate(years, income, { endY, endM, months = 12 } = {}) {
  let sumIncome = 0, sumDelta = 0, used = 0
  let y = endY, m = endM
  for (let i = 0; i < months; i++) {
    const r = savingsRateForMonth(years, income, y, m)
    if (r) { sumIncome += r.income; sumDelta += r.delta; used++ }
    m -= 1
    if (m < 0) { m = 11; y -= 1 }
  }
  if (!used || sumIncome <= 0) return null
  return { rate: sumDelta / sumIncome, monthsUsed: used, totalIncome: sumIncome, totalDelta: sumDelta }
}
