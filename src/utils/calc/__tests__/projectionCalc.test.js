import { describe, it, expect } from 'vitest'
import { projectWealth, yearsToTarget, avgMonthlyDelta, avgInflation, valueAfterMonths, planVsReal } from '../projectionCalc.js'

describe('projectWealth', () => {
  it('sem retorno nem contribuição, o valor mantém-se', () => {
    const s = projectWealth({ initial: 1000, years: 5 })
    expect(s).toHaveLength(6)
    expect(s.at(-1).nominal).toBeCloseTo(1000, 6)
  })

  it('capitalização composta: 7%/ano durante 10 anos ≈ ×1,967', () => {
    const s = projectWealth({ initial: 1000, annualReturn: 0.07, years: 10 })
    expect(s.at(-1).nominal).toBeCloseTo(1000 * Math.pow(1.07, 10), 0)
  })

  it('contribuições mensais acumulam', () => {
    const s = projectWealth({ initial: 0, monthlyContribution: 100, years: 1 })
    expect(s.at(-1).nominal).toBeCloseTo(1200, 6)
  })

  it('valor real desconta a inflação', () => {
    const s = projectWealth({ initial: 1000, annualReturn: 0.02, annualInflation: 0.02, years: 10 })
    expect(s.at(-1).real).toBeCloseTo(1000, 0)
  })
})

describe('yearsToTarget', () => {
  it('meta já atingida → 0', () => {
    expect(yearsToTarget({ initial: 5000, target: 5000 })).toBe(0)
  })

  it('sem meta → null', () => {
    expect(yearsToTarget({ initial: 100, target: 0 })).toBeNull()
    expect(yearsToTarget({ initial: 100 })).toBeNull()
  })

  it('1200 € com 100 €/mês sem retorno → 1 ano', () => {
    expect(yearsToTarget({ initial: 0, monthlyContribution: 100, target: 1200 })).toBe(1)
  })

  it('inatingível em 100 anos → null', () => {
    expect(yearsToTarget({ initial: 0, monthlyContribution: 1, target: 1e9 })).toBeNull()
  })

  it('coerente com projectWealth', () => {
    const args = { initial: 10000, monthlyContribution: 500, annualReturn: 0.05 }
    const anos = yearsToTarget({ ...args, target: 100000 })
    const série = projectWealth({ ...args, years: Math.ceil(anos) })
    expect(série.at(-1).nominal).toBeGreaterThanOrEqual(100000)
  })
})

describe('avgMonthlyDelta', () => {
  it('média do crescimento mensal entre primeiro e último snapshot', () => {
    const years = {
      2026: { months: {
        0: { banco: 1000 },
        1: { banco: 1100 },
        2: { banco: 1200 },
      } },
    }
    expect(avgMonthlyDelta(years)).toBeCloseTo(100, 6)
  })

  it('atravessa anos e tolera meses em falta', () => {
    const years = {
      2025: { months: { 10: { banco: 1000 } } },
      2026: { months: { 1: { banco: 1300 } } },  // 3 meses depois
    }
    expect(avgMonthlyDelta(years)).toBeCloseTo(100, 6)
  })

  it('null com menos de 2 snapshots', () => {
    expect(avgMonthlyDelta({ 2026: { months: { 0: { banco: 500 } } } })).toBeNull()
    expect(avgMonthlyDelta({})).toBeNull()
    expect(avgMonthlyDelta(null)).toBeNull()
  })
})

describe('valueAfterMonths / planVsReal', () => {
  it('valueAfterMonths coincide com projectWealth ao fim de anos inteiros', () => {
    const args = { initial: 10000, monthlyContribution: 300, annualReturn: 0.06 }
    const série = projectWealth({ ...args, years: 2 })
    expect(valueAfterMonths({ ...args, months: 24 })).toBeCloseTo(série.at(-1).nominal, 6)
  })

  it('planVsReal calcula o desvio face ao esperado', () => {
    const baseline = { startYear: 2026, startMonth: 0, initial: 10000, monthlyContribution: 500, annualReturn: 0 }
    // 6 meses depois: esperado = 10 000 + 6×500 = 13 000
    const r = planVsReal(baseline, 13500, new Date(2026, 6, 15))
    expect(r.months).toBe(6)
    expect(r.expected).toBeCloseTo(13000, 6)
    expect(r.delta).toBeCloseTo(500, 6)
  })

  it('null sem baseline ou com baseline futura', () => {
    expect(planVsReal(null, 1000)).toBeNull()
    const future = { startYear: 2030, startMonth: 0, initial: 0, monthlyContribution: 0, annualReturn: 0 }
    expect(planVsReal(future, 1000, new Date(2026, 0, 1))).toBeNull()
  })
})

describe('avgInflation', () => {
  it('média dos últimos n anos', () => {
    expect(avgInflation({ 2023: 0.04, 2024: 0.02, 2025: 0.03 }, 3)).toBeCloseTo(0.03, 6)
  })
  it('usa só os últimos n', () => {
    expect(avgInflation({ 2020: 0.99, 2024: 0.02, 2025: 0.04 }, 2)).toBeCloseTo(0.03, 6)
  })
  it('fallback quando não há dados', () => {
    expect(avgInflation({}, 5, 0.02)).toBe(0.02)
    expect(avgInflation(null)).toBe(0.02)
  })
})
