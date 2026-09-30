import { describe, it, expect } from 'vitest'
import { snapTotal, savingsRateForMonth, aggregateSavingsRate, avgMonthlySavings } from '../incomeCalc.js'

const years = {
  2026: { months: {
    3: { banco: 1000, etfs: 4000 },   // total 5000
    4: { banco: 1200, etfs: 4300 },   // total 5500 (Δ +500)
    5: { banco: 1100, etfs: 4200 },   // total 5300 (Δ −200)
  } },
}

describe('snapTotal', () => {
  it('soma os valores numéricos do snapshot', () => {
    expect(snapTotal({ banco: 100, etfs: 50 })).toBe(150)
    expect(snapTotal(null)).toBeNull()
  })
})

describe('savingsRateForMonth', () => {
  it('taxa = Δ património / rendimento', () => {
    const r = savingsRateForMonth(years, { '2026-4': 2000 }, 2026, 4)
    expect(r.delta).toBe(500)
    expect(r.rate).toBeCloseTo(0.25, 6)
  })

  it('taxa negativa quando o património cai', () => {
    const r = savingsRateForMonth(years, { '2026-5': 2000 }, 2026, 5)
    expect(r.rate).toBeCloseTo(-0.1, 6)
  })

  it('null sem rendimento ou sem snapshot do mês anterior', () => {
    expect(savingsRateForMonth(years, {}, 2026, 4)).toBeNull()
    expect(savingsRateForMonth(years, { '2026-3': 2000 }, 2026, 3)).toBeNull() // sem fev
  })

  it('atravessa a fronteira do ano (janeiro usa dezembro anterior)', () => {
    const y2 = {
      2025: { months: { 11: { banco: 1000 } } },
      2026: { months: { 0: { banco: 1300 } } },
    }
    const r = savingsRateForMonth(y2, { '2026-0': 1500 }, 2026, 0)
    expect(r.delta).toBe(300)
  })
})

describe('aggregateSavingsRate', () => {
  it('agrega Σ deltas / Σ rendimentos sobre os meses com dados', () => {
    const income = { '2026-4': 2000, '2026-5': 2000 }
    const agg = aggregateSavingsRate(years, income, { endY: 2026, endM: 5, months: 12 })
    expect(agg.monthsUsed).toBe(2)
    expect(agg.totalDelta).toBe(300)          // +500 − 200
    expect(agg.rate).toBeCloseTo(300 / 4000, 6)
  })

  it('null sem qualquer mês completo', () => {
    expect(aggregateSavingsRate(years, {}, { endY: 2026, endM: 5 })).toBeNull()
  })
})

describe('avgMonthlySavings', () => {
  it('usa dezembro do ano anterior como baseline (jan..mês atual)', () => {
    const y = { 2025: { months: { 11: { banco: 10000 } } } }
    // Em julho (m=6), total ao vivo 13500 → +3500 em 7 meses = 500/mês
    const r = avgMonthlySavings(y, 13500, 2026, 6)
    expect(r.avg).toBe(500)
    expect(r.months).toBe(7)
    expect(r.baselineMK).toBe('2025-11')
  })

  it('sem dezembro, usa o primeiro snapshot do ano', () => {
    // Primeiro snapshot do ano em abril (m=3, total 5000) → em julho (m=6)
    // conta 3 meses de variação (mai, jun, jul)
    const r = avgMonthlySavings(years, 6100, 2026, 6)
    expect(r.baselineMK).toBe('2026-3')
    expect(r.months).toBe(3)
    expect(r.avg).toBeCloseTo((6100 - 5000) / 3, 6)
  })

  it('média negativa quando o património caiu', () => {
    const y = { 2025: { months: { 11: { banco: 10000 } } } }
    expect(avgMonthlySavings(y, 9000, 2026, 4).avg).toBe(-200)
  })

  it('null sem baseline (primeiro ano, sem snapshots anteriores)', () => {
    expect(avgMonthlySavings({}, 5000, 2026, 6)).toBeNull()
    // Snapshot só no próprio mês atual não serve de baseline
    expect(avgMonthlySavings({ 2026: { months: { 6: { banco: 1 } } } }, 5000, 2026, 6)).toBeNull()
    expect(avgMonthlySavings(null, 5000, 2026, 6)).toBeNull()
  })
})
