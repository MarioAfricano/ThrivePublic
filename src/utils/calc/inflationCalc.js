// ── Cálculo de valor real ajustado a inflação (HICP Portugal) ───────
// rates: { year: decimal } e.g. { 2023: 0.055, 2024: 0.023 }
// Fonte: Eurostat HICP anual, variação homóloga média (RCH_A_AVG).
//
// Este módulo é puro — sem I/O nem React.

/**
 * Fator cumulativo de inflação entre fromYear (exclusive) e toYear (inclusive).
 * Para exprimir um valor nominal de toYear em euros de fromYear:
 *   realValue = nominal / cumulativeInflationFactor(rates, fromYear, toYear)
 */
export function cumulativeInflationFactor(rates, fromYear, toYear) {
  if (!rates || fromYear >= toYear) return 1
  let factor = 1
  for (let y = fromYear + 1; y <= toYear; y++) {
    if (rates[y] != null) factor *= (1 + rates[y])
  }
  return factor
}

/**
 * Valor em euros do ano fromYear, dado um nominal em euros do ano toYear.
 */
export function realValueIn(nominal, rates, fromYear, toYear) {
  if (fromYear === toYear) return nominal
  const factor = cumulativeInflationFactor(rates, fromYear, toYear)
  return factor > 0 ? nominal / factor : nominal
}

/**
 * Inflação total acumulada entre dois anos (0.15 = 15 %).
 */
export function totalInflation(rates, fromYear, toYear) {
  return cumulativeInflationFactor(rates, fromYear, toYear) - 1
}

/**
 * Anos com dados disponíveis, ordenados.
 */
export function availableInflationYears(rates) {
  return Object.keys(rates || {}).map(Number).sort((a, b) => a - b)
}
