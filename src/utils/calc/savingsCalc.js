// ── Camada de cálculos pura — Certificados de Aforro ───────────────
// Fonte: https://www.igcp.pt/pt/produtos-de-aforro/certificados-aforro/serie-f/ (regime actual)
//
// Invariantes:
//   - Taxa de juro base é o Euribor 3M da data de subscrição (depois fixa-se por períodos de 3 meses via rateHistory[ps]),
//     LIMITADA a 2,50% na Serie F. O bonus de permanencia acumula POR CIMA do cap,
//     logo a taxa efectiva pode passar de 2,50% (Ano 4+: 2,50% + 1,00% = 3,50%).
//   - Bónus por tempo (cumulativo com a taxa base, acumula mês a mês conforme o tier vigente nesse mês):
//       • Ano 1   (0-12 meses):  0.00%
//       • Ano 2  (12-24 meses): 0.25%
//       • Ano 3  (24-36 meses): 0.50%
//       • Ano 4+  (36+ meses):  1.00%
//   - IRS: retenção na fonte de 28% sobre os juros (aplicada ao total acumulado).
//   - Juros só são pagos em trimestres completos: se faltarem meses para o próximo trimestre, esses não contam.
//   - valueOverride: se estiver definido, sobrepõe-se a todo o cálculo (valor manual do utilizador).
//
// Este módulo é puro — nada de I/O nem React.

export const AFORRO_TIERS = [
  { min: 0,  max: 12, bonus: 0,      label: 'Ano 1',  color: '#60a5fa' },
  { min: 12, max: 24, bonus: 0.0025, label: 'Ano 2',  color: '#818cf8' },
  { min: 24, max: 36, bonus: 0.005,  label: 'Ano 3',  color: '#a78bfa' },
  { min: 36, max: Infinity, bonus: 0.01, label: 'Ano 4+', color: '#f472b6' },
]

export const AFORRO_IRS_RATE = 0.28

/**
 * Tecto da componente Euribor na Serie F: 2,50%.
 * Nao se aplica ao bonus de permanencia, que acumula por cima.
 */
export const AFORRO_EURIBOR_CAP = 0.025

/**
 * Aplica o tecto da Serie F a uma taxa base (Euribor ou valor guardado em
 * rateHistory). O cap e uma regra do produto, por isso vale tambem para as
 * taxas introduzidas a mao — na Serie F a base nunca excede 2,50%.
 */
export function capAforroBaseRate(rate) {
  return Math.min(rate || 0, AFORRO_EURIBOR_CAP)
}

/** Taxa efectiva = base (com tecto) + bonus do escalao. */
export function aforroEffectiveRate(baseRate, bonus = 0) {
  return capAforroBaseRate(baseRate) + bonus
}

/** Devolve o tier activo para `months` meses decorridos. */
export function getAforroTier(months) {
  return AFORRO_TIERS.find(t => months >= t.min && months < t.max) || AFORRO_TIERS[0]
}

/**
 * Meses decorridos desde `dateStr` até um alvo (mês `monthKey` — 1º dia —, ou `nowMs` se null).
 * Usa 30.4375 dias/mês (média).
 */
export function aforroMonthsAt(dateStr, monthKey = null, nowMs = Date.now()) {
  if (!dateStr) return 0
  const start = new Date(dateStr)
  let target
  if (monthKey) {
    const [y, m] = monthKey.split('-').map(Number)
    target = new Date(y, m, 1)
  } else {
    target = new Date(nowMs)
  }
  return Math.max(0, Math.floor((target - start) / (1000 * 60 * 60 * 24 * 30.4375)))
}

/**
 * Valor bruto de um certificado dado `totalMonths` decorridos.
 * Aplica trimestres completos, rateHistory[ps] fallback euribor, bónus de tier por mês,
 * e IRS no final. Se `valueOverride` existir, devolve-o sem cálculo.
 */
export function calcAforroValueFromMonths(cert, euribor, totalMonths) {
  if (cert?.valueOverride != null) return cert.valueOverride
  const amount = cert?.amount || 0
  const completedMonths = Math.floor(totalMonths / 3) * 3 // trimestres completos
  let interest = 0
  for (let m = 0; m < completedMonths; m++) {
    const ps    = Math.floor(m / 3) * 3
    const base  = cert?.rateHistory?.[ps] != null ? cert.rateHistory[ps] : (euribor || 0)
    const bonus = getAforroTier(m).bonus
    const rate  = aforroEffectiveRate(base, bonus)
    interest = Math.round((interest + amount * rate / 12) * 100) / 100
  }
  return Math.round((amount + interest * (1 - AFORRO_IRS_RATE)) * 100) / 100
}

/**
 * Valor de um certificado num dado mês (ou hoje).
 * Wrapper à volta de aforroMonthsAt + calcAforroValueFromMonths.
 */
export function calcAforroValueAt(cert, euribor, monthKey = null, nowMs = Date.now()) {
  if (cert?.valueOverride != null) return cert.valueOverride
  const months = aforroMonthsAt(cert?.date, monthKey, nowMs)
  return calcAforroValueFromMonths(cert, euribor, months)
}

/**
 * Total Aforro (soma dos certificados) para um mês específico.
 * Exclui certificados subscritos no próprio mês (regra: certificado só entra a partir do mês seguinte).
 */
export function calcAforroTotal(aforro, monthKey = null, nowMs = Date.now()) {
  const euribor = aforro?.euribor || 0
  return (aforro?.certificates || [])
    .filter(c => {
      if (!monthKey || !c.date) return true
      const [my, mm] = monthKey.split('-').map(Number)
      return new Date(c.date) < new Date(my, mm, 1)
    })
    .reduce((s, c) => s + calcAforroValueAt(c, euribor, monthKey, nowMs), 0)
}

// ── Helpers para o UI de estimativa do próximo pagamento ───────────
export function aforroAddMonths(dateStr, months) {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * Data do próximo pagamento de juros (trimestral desde a subscrição), relativa a `nowMs`.
 */
export function aforroNextPaymentDate(dateStr, nowMs = Date.now()) {
  const start = new Date(dateStr)
  const now = new Date(nowMs)
  const msPerMonth = 30.4375 * 24 * 60 * 60 * 1000
  const totalMonths = Math.floor((now - start) / msPerMonth)
  const completedQuarters = Math.floor(totalMonths / 3)
  let next = aforroAddMonths(dateStr, (completedQuarters + 1) * 3)
  if (next <= now) next = aforroAddMonths(dateStr, (completedQuarters + 2) * 3)
  return next
}

/**
 * Juros estimados do próximo pagamento trimestral (líquidos de IRS).
 * Usa a taxa do período actual (rateHistory[ps] ?? euribor, com tecto) + bónus do tier actual.
 */
export function aforroEstimateNextPayment(cert, euribor, nowMs = Date.now()) {
  const months = aforroMonthsAt(cert?.date, null, nowMs)
  const tier   = getAforroTier(months)
  const ps     = Math.floor(months / 3) * 3
  const rate   = aforroEffectiveRate((cert?.rateHistory?.[ps] ?? euribor) || 0, tier.bonus)
  return (cert?.amount || 0) * rate / 4 * (1 - AFORRO_IRS_RATE)
}
