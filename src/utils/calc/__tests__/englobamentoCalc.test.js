import { describe, it, expect } from 'vitest'
import {
  progressiveTax, compareEnglobamento, bracketsForYear, IRS_BRACKETS, AUTONOMOUS_RATE,
} from '../englobamentoCalc.js'

const B2025 = IRS_BRACKETS[2025]

describe('progressiveTax', () => {
  it('0 para rendimento nulo ou negativo', () => {
    expect(progressiveTax(0, B2025)).toBe(0)
    expect(progressiveTax(-100, B2025)).toBe(0)
  })

  it('primeiro escalão: taxa única de 12,5%', () => {
    expect(progressiveTax(8000, B2025)).toBeCloseTo(8000 * 0.125, 2)
  })

  it('acumula fatias: 10 000 € = 8 059×12,5% + 1 941×16%', () => {
    expect(progressiveTax(10000, B2025)).toBeCloseTo(8059 * 0.125 + (10000 - 8059) * 0.16, 2)
  })

  it('monótono crescente', () => {
    expect(progressiveTax(50000, B2025)).toBeGreaterThan(progressiveTax(30000, B2025))
    expect(progressiveTax(300000, B2025)).toBeGreaterThan(progressiveTax(100000, B2025))
  })
})

describe('bracketsForYear', () => {
  it('usa a tabela mais recente disponível ≤ ano', () => {
    expect(bracketsForYear(2026).tableYear).toBe(2025)
    expect(bracketsForYear(2025).tableYear).toBe(2025)
  })
  it('anos anteriores à primeira tabela usam a primeira', () => {
    expect(bracketsForYear(2020).tableYear).toBe(2025)
  })
})

describe('compareEnglobamento', () => {
  it('rendimento baixo → compensa englobar (taxa efetiva < 28%)', () => {
    const r = compareEnglobamento({ taxableIncome: 10000, gains: 2000, year: 2025 })
    expect(r.better).toBe('englobamento')
    expect(r.effectiveRate).toBeLessThan(AUTONOMOUS_RATE)
    expect(r.taxEnglobamento).toBeLessThan(r.taxAutonoma)
    expect(r.saving).toBeCloseTo(r.taxAutonoma - r.taxEnglobamento, 6)
  })

  it('rendimento alto → compensa a taxa autónoma', () => {
    const r = compareEnglobamento({ taxableIncome: 60000, gains: 5000, year: 2025 })
    expect(r.better).toBe('autonoma')
    expect(r.effectiveRate).toBeGreaterThan(AUTONOMOUS_RATE)
  })

  it('taxa autónoma = 28% dos ganhos', () => {
    const r = compareEnglobamento({ taxableIncome: 30000, gains: 1000, year: 2025 })
    expect(r.taxAutonoma).toBeCloseTo(280, 6)
  })

  it('sem ganhos (ou perdas) → better null e impostos 0', () => {
    expect(compareEnglobamento({ taxableIncome: 30000, gains: 0 }).better).toBeNull()
    const r = compareEnglobamento({ taxableIncome: 30000, gains: -500 })
    expect(r.better).toBeNull()
    expect(r.taxAutonoma).toBe(0)
  })

  it('o englobamento tributa só o acréscimo (fatia marginal)', () => {
    // ganhos que atravessam escalões: imposto = tax(income+gains) − tax(income)
    const r = compareEnglobamento({ taxableIncome: 8000, gains: 5000, year: 2025 })
    expect(r.taxEnglobamento).toBeCloseTo(
      progressiveTax(13000, B2025) - progressiveTax(8000, B2025), 6)
  })
})
