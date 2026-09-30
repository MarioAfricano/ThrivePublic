import { describe, it, expect } from 'vitest'
import { dividendYM, dividendsByMonth, trailingDividends, dividendSummary, dividendsByYear } from '../dividendCalc.js'

const holdings = [
  { id: 'h1', ticker: 'KO', lots: [{ buyMk: '2024-0', qty: 10, gasto: 500 }],
    dividends: [
      { mk: '2026-0', amount: 10 },
      { mk: '2026-3', amount: 12 },
      { mk: '2025-3', amount: 9 },
    ] },
  { id: 'h2', ticker: 'VWCE', lots: [{ buyMk: '2024-0', qty: 5, gasto: 1000 }],
    dividends: [{ date: '2026-04-15', amount: 20 }] },
  { id: 'h3', ticker: 'TSLA', lots: [{ buyMk: '2024-0', qty: 1, gasto: 200 }] }, // sem dividendos
]

describe('dividendYM', () => {
  it('usa mk (0-indexed) ou date', () => {
    expect(dividendYM({ mk: '2026-3' })).toEqual({ y: 2026, m: 3 })
    expect(dividendYM({ date: '2026-04-15' })).toEqual({ y: 2026, m: 3 })
    expect(dividendYM({})).toBeNull()
  })
})

describe('dividendsByYear', () => {
  it('totais por ano, ordenados', () => {
    expect(dividendsByYear(holdings)).toEqual([
      { year: 2025, total: 9 },
      { year: 2026, total: 42 },
    ])
  })
  it('vazio sem holdings ou sem dividendos', () => {
    expect(dividendsByYear([])).toEqual([])
    expect(dividendsByYear(null)).toEqual([])
  })
})

describe('dividendsByMonth', () => {
  it('agrega por mês do ano pedido', () => {
    const byMonth = dividendsByMonth(holdings, 2026)
    expect(byMonth[0]).toBe(10)
    expect(byMonth[3]).toBe(32) // 12 (mk) + 20 (date de abril)
    expect(byMonth.reduce((s, v) => s + v, 0)).toBe(42)
  })
})

describe('trailingDividends', () => {
  it('soma a janela de 12 meses atravessando anos', () => {
    // Jul 2025 → Jun 2026: inclui 2026-0 e 2026-3(+date), exclui 2025-3
    expect(trailingDividends(holdings, 2026, 5, 12)).toBe(42)
    // Janela que apanha também 2025-3
    expect(trailingDividends(holdings, 2026, 5, 18)).toBe(51)
  })
})

describe('dividendSummary', () => {
  it('lista pagadoras ordenadas com yield-on-cost', () => {
    const s = dividendSummary(holdings, 2026)
    expect(s.total).toBe(42)
    expect(s.positions).toHaveLength(2)
    expect(s.positions[0].ticker).toBe('KO')       // 22 > 20
    expect(s.positions[0].yoc).toBeCloseTo(22 / 500, 6)
    expect(s.positions[1].yoc).toBeCloseTo(20 / 1000, 6)
  })
})
