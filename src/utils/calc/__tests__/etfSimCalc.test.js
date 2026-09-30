import { describe, it, expect } from 'vitest'
import { simulateScenario, valueAtYear, milestoneYears, netValue, yearsToTargetScenario, WEEKS_PER_YEAR } from '../etfSimCalc.js'

describe('simulateScenario', () => {
  it('sem retorno nem reforço, o valor mantém-se', () => {
    const s = simulateScenario({ initial: 1000, years: 5 })
    expect(s).toHaveLength(61)
    expect(s.at(-1).value).toBeCloseTo(1000, 6)
    expect(s.at(-1).invested).toBeCloseTo(1000, 6)
  })

  it('capitalização composta: 7%/ano durante 10 anos ≈ ×1,967', () => {
    const s = simulateScenario({ initial: 1000, annualReturn: 0.07, years: 10 })
    expect(s.at(-1).value).toBeCloseTo(1000 * Math.pow(1.07, 10), 0)
  })

  it('TER subtrai ao retorno bruto', () => {
    const comTer = simulateScenario({ initial: 1000, annualReturn: 0.07, ter: 0.002, years: 10 })
    const liquido = simulateScenario({ initial: 1000, annualReturn: 0.068, years: 10 })
    expect(comTer.at(-1).value).toBeCloseTo(liquido.at(-1).value, 6)
  })

  it('reforço mensal sem retorno acumula linearmente', () => {
    const s = simulateScenario({ amount: 100, every: 1, unit: 'month', years: 1 })
    expect(s.at(-1).value).toBeCloseTo(1200, 6)
    expect(s.at(-1).invested).toBeCloseTo(1200, 6)
  })

  it('reforço de 2 em 2 meses → 6 reforços por ano', () => {
    const s = simulateScenario({ amount: 100, every: 2, unit: 'month', years: 1 })
    expect(s.at(-1).invested).toBeCloseTo(600, 6)
  })

  it('reforço semanal distribui 52,18 reforços por ano', () => {
    const s = simulateScenario({ amount: 50, every: 1, unit: 'week', years: 1 })
    expect(s.at(-1).invested).toBeCloseTo(50 * WEEKS_PER_YEAR, 4)
  })

  it('reforço anual entra no fim de cada ano', () => {
    const s = simulateScenario({ amount: 1000, every: 1, unit: 'year', years: 2 })
    expect(s[11].invested).toBe(0)
    expect(s[12].invested).toBe(1000)
    expect(s.at(-1).invested).toBe(2000)
  })

  it('stepUp aumenta o reforço a cada ano completo', () => {
    const s = simulateScenario({ amount: 100, every: 1, unit: 'month', stepUp: 0.10, years: 2 })
    // ano 1: 12×100 · ano 2: 12×110
    expect(s.at(-1).invested).toBeCloseTo(1200 + 1320, 6)
  })
})

describe('valueAtYear', () => {
  it('devolve o ponto mensal correspondente ao ano', () => {
    const s = simulateScenario({ amount: 100, years: 3 })
    expect(valueAtYear(s, 2)).toBe(s[24])
  })

  it('anos além do horizonte devolvem o último ponto', () => {
    const s = simulateScenario({ amount: 100, years: 3 })
    expect(valueAtYear(s, 99)).toBe(s.at(-1))
  })
})

describe('milestoneYears', () => {
  it('marcos clássicos + horizonte', () => {
    expect(milestoneYears(10)).toEqual([1, 3, 5, 7, 10])
    expect(milestoneYears(8)).toEqual([1, 3, 5, 7, 8])
  })

  it('horizontes longos mantêm no máximo 6 colunas', () => {
    expect(milestoneYears(40)).toEqual([10, 15, 20, 25, 30, 40])
  })
})

describe('yearsToTargetScenario', () => {
  it('meta já atingida → 0 · sem meta → null', () => {
    expect(yearsToTargetScenario({ initial: 5000 }, 5000)).toBe(0)
    expect(yearsToTargetScenario({ initial: 100 }, 0)).toBeNull()
  })

  it('1200 € com 100 €/mês sem retorno → 1 ano', () => {
    expect(yearsToTargetScenario({ amount: 100, every: 1, unit: 'month' }, 1200)).toBe(1)
  })

  it('inatingível em 100 anos → null', () => {
    expect(yearsToTargetScenario({ amount: 1, every: 1, unit: 'month' }, 1e9)).toBeNull()
  })
})

describe('netValue', () => {
  it('tributa as mais-valias a 28%', () => {
    expect(netValue({ value: 1500, invested: 1000 })).toBeCloseTo(1000 + 500 * 0.72, 6)
  })

  it('sem ganho não há imposto', () => {
    expect(netValue({ value: 900, invested: 1000 })).toBe(900)
  })
})
