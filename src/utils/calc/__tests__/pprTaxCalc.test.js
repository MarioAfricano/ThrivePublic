import { describe, it, expect } from 'vitest'
import { pprBracketForAge, ageAtJan1, pprInvestedInYear, pprTaxBenefit } from '../pprTaxCalc.js'

const platforms = (contribs) => [
  { id: 'p1', name: 'X', accounts: [{ id: 'a1', contributions: contribs }] },
]

describe('ageAtJan1', () => {
  it('idade a 1 de janeiro = ano − nascimento − 1', () => {
    expect(ageAtJan1(2026, 1990)).toBe(35)
    expect(ageAtJan1(2026, 2000)).toBe(25)
  })
  it('null sem ano de nascimento válido', () => {
    expect(ageAtJan1(2026, null)).toBeNull()
    expect(ageAtJan1(2026, 2030)).toBeNull()
  })
})

describe('pprBracketForAge', () => {
  it('escalões corretos', () => {
    expect(pprBracketForAge(25).maxDeduction).toBe(400)
    expect(pprBracketForAge(34).maxInvestment).toBe(2000)
    expect(pprBracketForAge(35).maxDeduction).toBe(350)
    expect(pprBracketForAge(50).maxDeduction).toBe(350)
    expect(pprBracketForAge(51).maxDeduction).toBe(300)
    expect(pprBracketForAge(51).maxInvestment).toBe(1500)
  })
  it('null para idade inválida', () => {
    expect(pprBracketForAge(null)).toBeNull()
    expect(pprBracketForAge(NaN)).toBeNull()
  })
})

describe('pprInvestedInYear', () => {
  it('soma só as entregas do ano civil', () => {
    const p = platforms([
      { mk: '2026-0', valorPago: 500, valorColocado: 490 },
      { mk: '2026-11', valorPago: 300, valorColocado: 300 },
      { mk: '2025-5', valorPago: 999, valorColocado: 999 },
    ])
    expect(pprInvestedInYear(p, 2026)).toBe(800)
    expect(pprInvestedInYear(p, 2025)).toBe(999)
    expect(pprInvestedInYear(p, 2024)).toBe(0)
  })

  it('levantamentos (valorPago < 0) não reduzem o valor aplicado', () => {
    const p = platforms([
      { mk: '2026-0', valorPago: 1000, valorColocado: 1000 },
      { mk: '2026-6', valorPago: -400, valorColocado: -400 },
    ])
    expect(pprInvestedInYear(p, 2026)).toBe(1000)
  })
})

describe('pprTaxBenefit', () => {
  it('20% do investido quando abaixo do teto', () => {
    const p = platforms([{ mk: '2026-2', valorPago: 1000, valorColocado: 1000 }])
    const b = pprTaxBenefit(p, 2026, 1995) // idade a 1 jan = 30 → teto 400
    expect(b.deduction).toBe(200)
    expect(b.remainingInvestment).toBe(1000)
    expect(b.maxed).toBe(false)
  })

  it('trava no teto do escalão', () => {
    const p = platforms([{ mk: '2026-2', valorPago: 3000, valorColocado: 3000 }])
    const b = pprTaxBenefit(p, 2026, 1995) // teto 400 (< 35)
    expect(b.deduction).toBe(400)
    expect(b.remainingInvestment).toBe(0)
    expect(b.maxed).toBe(true)
  })

  it('usa o teto do escalão 35–50', () => {
    const p = platforms([{ mk: '2026-2', valorPago: 2000, valorColocado: 2000 }])
    const b = pprTaxBenefit(p, 2026, 1985) // idade a 1 jan = 40
    expect(b.deduction).toBe(350)
  })

  it('sem ano de nascimento devolve invested mas deduction null', () => {
    const p = platforms([{ mk: '2026-2', valorPago: 500, valorColocado: 500 }])
    const b = pprTaxBenefit(p, 2026, null)
    expect(b.invested).toBe(500)
    expect(b.deduction).toBeNull()
    expect(b.bracket).toBeNull()
  })
})
