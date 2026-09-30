import { describe, it, expect } from 'vitest'
import { xirr, xnpv, mkToDate, holdingCashflows, portfolioXirr } from '../xirrCalc.js'

const DAY = 24 * 3600 * 1000
const YEAR = 365.25 * DAY
const T0 = new Date(2024, 0, 15).getTime()

describe('mkToDate', () => {
  it('converte mk para o dia 15 do mês (0-indexed)', () => {
    const d = new Date(mkToDate('2025-0'))
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(15)
  })
  it('devolve null para mk ausente ou inválido', () => {
    expect(mkToDate(null)).toBeNull()
    expect(mkToDate('abc')).toBeNull()
  })
})

describe('xirr', () => {
  it('investimento que duplica num ano → ~100%/ano', () => {
    const r = xirr([
      { amount: -1000, date: T0 },
      { amount: 2000, date: T0 + YEAR },
    ])
    expect(r).toBeCloseTo(1.0, 2)
  })

  it('+10% em exactamente um ano → ~10%/ano', () => {
    const r = xirr([
      { amount: -1000, date: T0 },
      { amount: 1100, date: T0 + YEAR },
    ])
    expect(r).toBeCloseTo(0.10, 3)
  })

  it('+10% em dois anos → ~4,88%/ano (anualização composta)', () => {
    const r = xirr([
      { amount: -1000, date: T0 },
      { amount: 1100, date: T0 + 2 * YEAR },
    ])
    expect(r).toBeCloseTo(Math.sqrt(1.1) - 1, 3)
  })

  it('perda de 50% num ano → −50%/ano', () => {
    const r = xirr([
      { amount: -1000, date: T0 },
      { amount: 500, date: T0 + YEAR },
    ])
    expect(r).toBeCloseTo(-0.5, 3)
  })

  it('múltiplos fluxos: xnpv(xirr) ≈ 0', () => {
    const flows = [
      { amount: -1000, date: T0 },
      { amount: -500, date: T0 + 0.5 * YEAR },
      { amount: 30, date: T0 + 0.75 * YEAR },   // dividendo
      { amount: 1800, date: T0 + 1.5 * YEAR },
    ]
    const r = xirr(flows)
    expect(r).not.toBeNull()
    expect(Math.abs(xnpv(r, flows))).toBeLessThan(0.01)
  })

  it('null quando não há mudança de sinal', () => {
    expect(xirr([{ amount: -100, date: T0 }, { amount: -50, date: T0 + YEAR }])).toBeNull()
    expect(xirr([{ amount: 100, date: T0 }, { amount: 50, date: T0 + YEAR }])).toBeNull()
  })

  it('null com menos de dois fluxos ou span < 15 dias', () => {
    expect(xirr([{ amount: -100, date: T0 }])).toBeNull()
    expect(xirr([{ amount: -100, date: T0 }, { amount: 110, date: T0 + 5 * DAY }])).toBeNull()
    expect(xirr([])).toBeNull()
    expect(xirr(null)).toBeNull()
  })

  it('ignora fluxos com amount 0 ou sem data', () => {
    const r = xirr([
      { amount: -1000, date: T0 },
      { amount: 0, date: T0 + 0.5 * YEAR },
      { amount: 1100, date: null },
      { amount: 1100, date: T0 + YEAR },
    ])
    expect(r).toBeCloseTo(0.10, 3)
  })
})

describe('holdingCashflows', () => {
  const NOW = new Date(2026, 5, 15).getTime()

  it('posição activa: lots negativos + valor actual positivo hoje', () => {
    const h = {
      lots: [
        { buyMk: '2025-0', qty: 10, gasto: 1000 },
        { buyMk: '2025-6', qty: 5, gasto: 600 },
      ],
    }
    const flows = holdingCashflows(h, { currentValue: 2000, now: NOW })
    expect(flows).toHaveLength(3)
    expect(flows.filter(f => f.amount < 0).map(f => f.amount)).toEqual([-1000, -600])
    expect(flows.find(f => f.amount === 2000).date).toBe(NOW)
  })

  it('posição vendida: usa sellTotal no sellMk e não o currentValue', () => {
    const h = {
      lots: [{ buyMk: '2024-0', qty: 10, gasto: 1000 }],
      sellMk: '2025-0', sellTotal: 1500,
    }
    const flows = holdingCashflows(h, { currentValue: 9999, now: NOW })
    expect(flows.map(f => f.amount).sort((a, b) => a - b)).toEqual([-1000, 1500])
  })

  it('vendas parciais (sell lots) entram como fluxo positivo', () => {
    const h = {
      lots: [
        { buyMk: '2024-0', qty: 10, gasto: 1000 },
        { buyMk: '2025-0', qty: -5, isSell: true, sellTotal: 700 },
      ],
    }
    const flows = holdingCashflows(h, { currentValue: 800, now: NOW })
    expect(flows.map(f => f.amount).sort((a, b) => a - b)).toEqual([-1000, 700, 800])
  })

  it('dividendos entram na data (ou mk) com valor positivo', () => {
    const h = {
      lots: [{ buyMk: '2024-0', qty: 10, gasto: 1000 }],
      dividends: [{ mk: '2024-6', amount: 25 }],
    }
    const flows = holdingCashflows(h, { currentValue: 1100, now: NOW })
    expect(flows.find(f => f.amount === 25)).toBeTruthy()
  })

  it('holding legado sem lots usa gasto/buyMk da raiz', () => {
    const h = { gasto: 500, buyMk: '2024-0', qty: 5 }
    const flows = holdingCashflows(h, { currentValue: 600, now: NOW })
    expect(flows.map(f => f.amount).sort((a, b) => a - b)).toEqual([-500, 600])
  })
})

describe('portfolioXirr', () => {
  it('agrega fluxos de várias holdings', () => {
    const NOW = new Date(2026, 0, 15).getTime()
    const holdings = [
      { id: 'a', lots: [{ buyMk: '2025-0', qty: 10, gasto: 1000 }] },
      { id: 'b', lots: [{ buyMk: '2024-0', qty: 10, gasto: 1000 }], sellMk: '2025-0', sellTotal: 1100 },
    ]
    const r = portfolioXirr(holdings, () => 1100, NOW)
    expect(r).not.toBeNull()
    expect(r).toBeGreaterThan(0)
  })
})
