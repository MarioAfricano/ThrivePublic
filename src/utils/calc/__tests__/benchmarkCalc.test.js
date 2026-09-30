import { describe, it, expect } from 'vitest'
import { priceAtDate, simulateFlowsOnBenchmark, benchmarkXirr } from '../benchmarkCalc.js'

// Benchmark sintético: 100 → 110 → 121 (10%/período)
const points = [
  { year: 2025, month: 0, price: 100 },
  { year: 2025, month: 6, price: 110 },
  { year: 2026, month: 0, price: 121 },
]

const d = (y, m) => new Date(y, m, 15).getTime()

describe('priceAtDate', () => {
  it('último preço mensal <= data', () => {
    expect(priceAtDate(points, d(2025, 0))).toBe(100)
    expect(priceAtDate(points, d(2025, 3))).toBe(100)
    expect(priceAtDate(points, d(2025, 8))).toBe(110)
    expect(priceAtDate(points, d(2026, 5))).toBe(121)
  })
  it('null antes do primeiro ponto ou sem pontos', () => {
    expect(priceAtDate(points, d(2024, 5))).toBeNull()
    expect(priceAtDate([], d(2026, 0))).toBeNull()
  })
})

describe('simulateFlowsOnBenchmark', () => {
  it('investimento único acompanha o índice', () => {
    const sim = simulateFlowsOnBenchmark([{ amount: -1000, date: d(2025, 0) }], points, d(2026, 0))
    expect(sim.finalValue).toBeCloseTo(1210, 6) // 10 unidades × 121
  })

  it('levantamento vende unidades ao preço da data', () => {
    const sim = simulateFlowsOnBenchmark([
      { amount: -1000, date: d(2025, 0) },  // compra 10 un.
      { amount: 550, date: d(2025, 6) },    // vende 5 un. a 110
    ], points, d(2026, 0))
    expect(sim.finalValue).toBeCloseTo(5 * 121, 6)
  })

  it('null se o histórico não cobre alguma data', () => {
    expect(simulateFlowsOnBenchmark([{ amount: -100, date: d(2024, 0) }], points, d(2026, 0))).toBeNull()
  })
})

describe('benchmarkXirr', () => {
  it('XIRR do índice com os fluxos da carteira (~10%/ano)', () => {
    const holdings = [{ id: 'h1', lots: [{ buyMk: '2025-0', qty: 10, gasto: 1000 }] }]
    const r = benchmarkXirr(holdings, points, d(2026, 0))
    expect(r).not.toBeNull()
    expect(r.finalValue).toBeCloseTo(1210, 6)
    expect(r.rate).toBeCloseTo(0.21, 1) // 100→121 em 1 ano = 21%
    expect(r.invested).toBe(1000)
  })

  it('null sem holdings ou sem cobertura de preços', () => {
    expect(benchmarkXirr([], points)).toBeNull()
    const early = [{ id: 'h1', lots: [{ buyMk: '2020-0', qty: 1, gasto: 100 }] }]
    expect(benchmarkXirr(early, points, d(2026, 0))).toBeNull()
  })
})
