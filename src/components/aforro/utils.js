import {
  aforroMonthsAt,
  calcAforroValueAt,
} from '../../utils/calc/savingsCalc.js'

// ── Meses decorridos desde a subscrição do certificado ───────────
export function monthsElapsed(dateStr) { return aforroMonthsAt(dateStr, null) }

// ── Dias até uma data (arredonda para cima) ──────────────────────
export function daysUntil(date) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const t   = new Date(date); t.setHours(0, 0, 0, 0)
  return Math.ceil((t - now) / 86400000)
}

// ── Formata data em pt-PT ("12 Mar 2025") ────────────────────────
export function fmtDate(d) {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Valor actual do certificado (inclui juros acumulados) ────────
export function calcValue(cert, euribor) { return calcAforroValueAt(cert, euribor, null) }

// ── Fetch Euribor 3M da API do BCE ──────────────────────────────
// Usa lastNObservations=1 para receber apenas o mês mais recente.
// Devolve em decimal (ex: 0.020113 para 2.0113%).
export async function fetchEuribor3M() {
  const url = 'https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA?lastNObservations=1&detail=dataonly&format=jsondata'
  const res = await fetch(url)
  if (!res.ok) throw new Error('ECB API error')
  const json = await res.json()
  const series = Object.values(json.dataSets[0].series)[0]
  // observations é { "0": [valor], ... } — com 1 observação há apenas "0"
  const obs = Object.values(series.observations)[0]
  return obs[0] / 100 // % → decimal
}
