// ── Benefício fiscal do PPR (dedução à coleta, IRS PT) ─────────────
// Art. 21.º do EBF: dedução à coleta de 20% dos valores aplicados em
// PPR no ano, com tetos por idade (aferida a 1 de janeiro do ano fiscal):
//   < 35 anos   → máx. 400 €  (investimento útil até 2 000 €)
//   35–50 anos  → máx. 350 €  (até 1 750 €)
//   > 50 anos   → máx. 300 €  (até 1 500 €)
// Nota: a dedução está ainda sujeita ao teto global de deduções à coleta
// por escalão de rendimento, e entregas após a reforma não contam —
// ambos fora do âmbito deste cálculo (avisados na UI).

export const PPR_DEDUCTION_RATE = 0.20

export function pprBracketForAge(age) {
  if (age == null || isNaN(age) || age < 0) return null
  if (age < 35)  return { label: 'menos de 35 anos', maxDeduction: 400, maxInvestment: 2000 }
  if (age <= 50) return { label: '35 a 50 anos',     maxDeduction: 350, maxInvestment: 1750 }
  return { label: 'mais de 50 anos', maxDeduction: 300, maxInvestment: 1500 }
}

// Idade a 1 de janeiro de `year` para quem nasceu em `birthYear`.
// Sem o dia/mês de nascimento, a 1 de janeiro já se fez o aniversário
// de todos os anos anteriores: idade = year − birthYear − 1.
export function ageAtJan1(year, birthYear) {
  if (!birthYear || !year || birthYear >= year) return null
  return year - birthYear - 1
}

// Soma das entregas (valorPago > 0) feitas no ano civil `year`.
// Levantamentos (valorPago < 0) não reduzem o valor aplicado.
export function pprInvestedInYear(platforms, year) {
  let total = 0
  for (const p of platforms || [])
    for (const a of p.accounts || [])
      for (const c of a.contributions || []) {
        const cy = Number(String(c.mk || '').split('-')[0])
        if (cy === year && (c.valorPago || 0) > 0) total += c.valorPago
      }
  return total
}

export function pprTaxBenefit(platforms, year, birthYear) {
  const invested = pprInvestedInYear(platforms, year)
  const age      = ageAtJan1(year, birthYear)
  const bracket  = pprBracketForAge(age)
  if (!bracket) {
    return { invested, age: null, bracket: null, deduction: null, remainingInvestment: null, maxed: false }
  }
  const deduction           = Math.min(invested * PPR_DEDUCTION_RATE, bracket.maxDeduction)
  const remainingInvestment = Math.max(0, bracket.maxInvestment - invested)
  return { invested, age, bracket, deduction, remainingInvestment, maxed: remainingInvestment === 0 }
}
