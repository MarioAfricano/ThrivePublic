import { describe, it, expect } from 'vitest'
import { pickHistoricalMatch } from '../useFetchStockPrice.js'

describe('pickHistoricalMatch', () => {
  const points = [
    { year: 2025, month: 10, price: 100 },
    { year: 2025, month: 11, price: 110 },
    { year: 2026, month: 0,  price: 120 },
    { year: 2026, month: 3,  price: 150 },
  ]

  it('devolve match exacto quando (year, month) coincide', () => {
    expect(pickHistoricalMatch(points, 2026, 0)).toMatchObject({ price: 120 })
    expect(pickHistoricalMatch(points, 2025, 10)).toMatchObject({ price: 100 })
  })

  it('fallback para o ponto ≤ target mais próximo', () => {
    // Target Fev 2026 (mês 1): não há match, último ≤ é Jan 2026 (mês 0)
    expect(pickHistoricalMatch(points, 2026, 1)).toMatchObject({ price: 120 })
  })

  it('fallback para ano anterior quando target é em ano sem pontos', () => {
    expect(pickHistoricalMatch(points, 2027, 5)).toMatchObject({ price: 150 })
  })

  it('null quando array vazio ou undefined', () => {
    expect(pickHistoricalMatch([], 2026, 0)).toBeNull()
    expect(pickHistoricalMatch(undefined, 2026, 0)).toBeNull()
    expect(pickHistoricalMatch(null, 2026, 0)).toBeNull()
  })

  it('null quando target é anterior a todos os pontos', () => {
    expect(pickHistoricalMatch(points, 2024, 5)).toBeNull()
  })
})
