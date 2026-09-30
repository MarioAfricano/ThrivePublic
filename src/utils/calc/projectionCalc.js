// ── Projeção de património (juros compostos + contribuição mensal) ──
// Cálculos puros para a página Projeção: crescimento composto mensal,
// tempo até atingir uma meta, e sugestão de contribuição a partir do
// histórico de snapshots mensais.

// Série anual projetada: [{ yearIndex, nominal, real }].
// `annualReturn` e `annualInflation` em fração (0.05 = 5%).
// Capitalização mensal: r_m = (1+r)^(1/12) − 1; contribuição no fim do mês.
export function projectWealth({ initial = 0, monthlyContribution = 0, annualReturn = 0, years = 30, annualInflation = 0 }) {
  const rm  = Math.pow(1 + annualReturn, 1 / 12) - 1
  const out = [{ yearIndex: 0, nominal: initial, real: initial }]
  let v = initial
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) v = v * (1 + rm) + monthlyContribution
    out.push({ yearIndex: y, nominal: v, real: v / Math.pow(1 + annualInflation, y) })
  }
  return out
}

// Valor projetado após `months` meses (mesma matemática de projectWealth).
export function valueAfterMonths({ initial = 0, monthlyContribution = 0, annualReturn = 0, months = 0 }) {
  const rm = Math.pow(1 + annualReturn, 1 / 12) - 1
  let v = initial
  for (let i = 0; i < months; i++) v = v * (1 + rm) + monthlyContribution
  return v
}

// Compara o património actual com o plano guardado (baseline da página
// Projeção). Devolve null sem baseline ou se o plano é do futuro.
// baseline: { startYear, startMonth, initial, monthlyContribution, annualReturn }
export function planVsReal(baseline, actualTotal, now = new Date()) {
  if (!baseline || baseline.startYear == null) return null
  const months = (now.getFullYear() - baseline.startYear) * 12 + (now.getMonth() - baseline.startMonth)
  if (months < 0) return null
  const expected = valueAfterMonths({
    initial: baseline.initial, monthlyContribution: baseline.monthlyContribution,
    annualReturn: baseline.annualReturn, months,
  })
  return { expected, delta: actualTotal - expected, months }
}

// Anos (fração, granularidade mensal) até `target`; null se >100 anos.
export function yearsToTarget({ initial = 0, monthlyContribution = 0, annualReturn = 0, target }) {
  if (!target || target <= 0) return null
  if (initial >= target) return 0
  const rm = Math.pow(1 + annualReturn, 1 / 12) - 1
  let v = initial
  for (let m = 1; m <= 1200; m++) {
    v = v * (1 + rm) + monthlyContribution
    if (v >= target) return m / 12
  }
  return null
}

// Crescimento médio mensal do património total no histórico de snapshots
// (`data.years`), sobre os últimos `maxMonths` meses disponíveis.
// Inclui valorização de mercado — é uma sugestão, não a poupança exata.
export function avgMonthlyDelta(years, { maxMonths = 12 } = {}) {
  const totals = []
  for (const [y, yd] of Object.entries(years || {})) {
    for (const [m, snap] of Object.entries(yd?.months || {})) {
      const total = Object.values(snap || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
      if (total > 0) totals.push({ idx: Number(y) * 12 + Number(m), total })
    }
  }
  totals.sort((a, b) => a.idx - b.idx)
  if (totals.length < 2) return null
  const recent = totals.slice(-(maxMonths + 1))
  const first  = recent[0], last = recent.at(-1)
  const span   = last.idx - first.idx
  if (span <= 0) return null
  return (last.total - first.total) / span
}

// Média das taxas de inflação dos últimos `n` anos disponíveis.
// `rates`: { 2023: 0.043, 2024: 0.024, ... } (frações, HICP Eurostat).
export function avgInflation(rates, n = 5, fallback = 0.02) {
  const entries = Object.entries(rates || {})
    .map(([y, r]) => [Number(y), r])
    .filter(([, r]) => typeof r === 'number' && isFinite(r))
    .sort((a, b) => a[0] - b[0])
    .slice(-n)
  if (!entries.length) return fallback
  return entries.reduce((s, [, r]) => s + r, 0) / entries.length
}
