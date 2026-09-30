import { describe, it, expect } from 'vitest'
import { toEUR, resolveRate } from '../currencyUtils.js'

describe('toEUR', () => {
  it('devolve o valor sem modificação para EUR', () => {
    expect(toEUR(100, { currency: 'EUR' }, null, null)).toBe(100)
    expect(toEUR(100, {}, null, null)).toBe(100) // undefined currency → assume EUR
  })

  it('preferência 1: liveRates sobrepõe-se a monthData.rateToEUR', () => {
    const acc = { currency: 'USD' }
    const monthData = { rateToEUR: 0.90 }
    const liveRates = { USD: 0.92 }
    // Deve usar 0.92 (live), não 0.90 (frozen)
    expect(toEUR(100, acc, monthData, liveRates)).toBeCloseTo(92, 8)
  })

  it('preferência 2: sem liveRates usa monthData.rateToEUR', () => {
    const acc = { currency: 'USD' }
    const monthData = { rateToEUR: 0.90 }
    expect(toEUR(100, acc, monthData, null)).toBeCloseTo(90, 8)
  })

  it('preferência 3: fallback 1.0 sem taxas', () => {
    expect(toEUR(100, { currency: 'USD' }, null, null)).toBe(100)
    expect(toEUR(100, { currency: 'USD' }, {}, {})).toBe(100)
  })

  it('lida com monthData undefined', () => {
    expect(toEUR(50, { currency: 'GBP' }, undefined, { GBP: 1.15 })).toBeCloseTo(57.5, 8)
  })

  it('nunca aplica taxa a EUR mesmo se as taxas estiverem definidas', () => {
    // Invariante: EUR não é convertido.
    expect(toEUR(100, { currency: 'EUR' }, { rateToEUR: 999 }, { EUR: 2 })).toBe(100)
  })
})

describe('resolveRate', () => {
  it('EUR devolve 1.0 sempre', () => {
    expect(resolveRate('EUR', { liveRates: { EUR: 5 } })).toBe(1.0)
    expect(resolveRate('EUR', {})).toBe(1.0)
    expect(resolveRate(null, {})).toBe(1.0)
  })

  it('mês aberto (locked=false): prefere live', () => {
    expect(resolveRate('USD', {
      liveRates: { USD: 0.92 },
      monthData: { rateToEUR: 0.88 },
      locked: false,
    })).toBeCloseTo(0.92, 8)
  })

  it('mês fechado (locked=true): usa taxa congelada, ignora live', () => {
    expect(resolveRate('USD', {
      liveRates: { USD: 0.92 },
      monthData: { rateToEUR: 0.88 },
      locked: true,
    })).toBeCloseTo(0.88, 8)
  })

  it('mês fechado sem monthData: fallback para 1.0', () => {
    // Caso-limite: mês fechado mas a taxa nunca foi guardada → 1.0 em vez de live
    expect(resolveRate('USD', { liveRates: { USD: 0.92 }, locked: true })).toBe(1.0)
  })

  it('mês aberto sem live: usa frozen', () => {
    expect(resolveRate('USD', { monthData: { rateToEUR: 0.85 }, locked: false })).toBeCloseTo(0.85, 8)
  })

  it('sem live e sem frozen: fallback 1.0', () => {
    expect(resolveRate('USD', {})).toBe(1.0)
    expect(resolveRate('USD', { liveRates: {}, monthData: {} })).toBe(1.0)
  })
})
