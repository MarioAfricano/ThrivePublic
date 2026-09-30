// ── Cenários hipotéticos de juros compostos (página Projeção) ──────
// Cálculos puros para as linhas comparativas da Projeção. Cada cenário
// é simulado mês a mês: retorno líquido (retorno anual − TER)
// capitalizado mensalmente, com reforços na cadência escolhida
// (semanas/meses/anos). Independente dos dados reais da app.

export const WEEKS_PER_YEAR = 52.1775

export const UNIT_OPTIONS = [
  { value: 'week',  singular: 'semana', plural: 'semanas' },
  { value: 'month', singular: 'mês',    plural: 'meses' },
  { value: 'year',  singular: 'ano',    plural: 'anos' },
]

// Série mensal [{ month, value, invested }] (month 0 = hoje).
// `every` + `unit` definem a cadência do reforço (ex.: 2 + 'week').
// Reforços semanais são distribuídos uniformemente pelos meses
// (ex.: semanal → 52,18/12 reforços por mês): o total investido é
// exato, o timing é aproximado ao mês — diferença desprezável a anos.
// `stepUp`: aumento anual do reforço em fração (0.02 = +2% por ano).
// `ter`: custos anuais do ETF em fração — subtraído ao retorno.
export function simulateScenario({
  initial = 0, amount = 0, every = 1, unit = 'month',
  annualReturn = 0, ter = 0, stepUp = 0, years = 10,
}) {
  const rm     = Math.pow(1 + (annualReturn - ter), 1 / 12) - 1
  const ev     = Math.max(1, Math.round(every))
  const months = Math.max(1, Math.round(years * 12))

  let value = initial, invested = initial
  const out = [{ month: 0, value, invested }]
  for (let m = 1; m <= months; m++) {
    const contrib = amount * Math.pow(1 + stepUp, Math.floor((m - 1) / 12))
    value *= 1 + rm
    if (unit === 'week') {
      const perMonth = contrib * WEEKS_PER_YEAR / (12 * ev)
      value += perMonth; invested += perMonth
    } else {
      const cadence = unit === 'year' ? ev * 12 : ev
      if (m % cadence === 0) { value += contrib; invested += contrib }
    }
    out.push({ month: m, value, invested })
  }
  return out
}

// Ponto da série no ano `year` (limitado ao fim da série).
export function valueAtYear(series, year) {
  return series[Math.min(series.length - 1, Math.round(year * 12))]
}

// Marcos a mostrar na tabela: os clássicos que couberem + o horizonte.
export function milestoneYears(horizon) {
  const marks = [1, 3, 5, 7, 10, 15, 20, 25, 30].filter(y => y < horizon)
  return [...marks.slice(-5), horizon]
}

// Anos (fração, granularidade mensal) até um cenário atingir `target`;
// null se >100 anos. Mesma semântica de yearsToTarget (projectionCalc),
// mas suporta cadência/TER/stepUp por simular a série completa.
export function yearsToTargetScenario(params, target) {
  if (!target || target <= 0) return null
  if ((params.initial || 0) >= target) return 0
  const s = simulateScenario({ ...params, years: 100 })
  const idx = s.findIndex(p => p.value >= target)
  return idx === -1 ? null : idx / 12
}

// Valor de resgate líquido: mais-valias tributadas a `taxRate`
// (28% em Portugal, englobamento à parte). Sem ganho → sem imposto.
export function netValue({ value, invested }, taxRate = 0.28) {
  const gain = value - invested
  return gain <= 0 ? value : invested + gain * (1 - taxRate)
}
