import { describe, it, expect } from 'vitest'
import { buildLockMonthPatch, buildUnlockMonthPatch, isMonthFullyLocked } from '../lockMonth.js'

const base = () => ({
  years: { 2026: { goal: 10000, lockedMonths: [], months: { 5: { banco: 100 } } } },
  stocks: { years: {}, acoes: { holdings: [] }, etfs: { holdings: [] } },
  crypto: {
    years: {},
    platforms: [{ id: 'p1', name: 'X', holdings: [{ id: 'h1', ticker: 'BTC', price: 50000, monthData: {} }] }],
  },
})

describe('buildLockMonthPatch', () => {
  it('fecha os três sistemas de uma vez', () => {
    const patch = buildLockMonthPatch(base(), 2026, 5)
    expect(patch.years[2026].lockedMonths).toContain(5)
    expect(patch.stocks.years[2026].lockedMonths).toContain(5)
    expect(patch.crypto.years[2026].lockedMonths).toContain(5)
  })

  it('congela o preço crypto no snapshot (como o closeMonth da página)', () => {
    const patch = buildLockMonthPatch(base(), 2026, 5)
    expect(patch.crypto.platforms[0].holdings[0].monthData['2026-5'].price).toBe(50000)
  })

  it('não sobrepõe um preço crypto já congelado', () => {
    const d = base()
    d.crypto.platforms[0].holdings[0].monthData['2026-5'] = { price: 42000 }
    const patch = buildLockMonthPatch(d, 2026, 5)
    expect(patch.crypto.platforms[0].holdings[0].monthData['2026-5'].price).toBe(42000)
  })

  it('é idempotente: sistemas já fechados ficam fora do patch', () => {
    const d = base()
    d.years[2026].lockedMonths = [5]
    d.crypto.years = { 2026: { lockedMonths: [5] } }
    const patch = buildLockMonthPatch(d, 2026, 5)
    expect(patch.years).toBeUndefined()
    expect(patch.crypto).toBeUndefined()
    expect(patch.stocks.years[2026].lockedMonths).toContain(5) // só faltava este
  })

  it('sem stocks/crypto nos dados, só fecha o global', () => {
    const patch = buildLockMonthPatch({ years: {} }, 2026, 5)
    expect(patch.years[2026].lockedMonths).toContain(5)
    expect(patch.stocks).toBeUndefined()
    expect(patch.crypto).toBeUndefined()
  })
})

describe('buildUnlockMonthPatch', () => {
  const locked = () => {
    const d = base()
    d.years[2026].lockedMonths = [4, 5]
    d.stocks.years = { 2026: { lockedMonths: [5] } }
    d.crypto.years = { 2026: { lockedMonths: [5] } }
    d.crypto.platforms[0].holdings[0].monthData['2026-5'] = { price: 42000 }
    return d
  }

  it('reabre os três sistemas, mantendo outros meses fechados', () => {
    const patch = buildUnlockMonthPatch(locked(), 2026, 5)
    expect(patch.years[2026].lockedMonths).toEqual([4])
    expect(patch.stocks.years[2026].lockedMonths).toEqual([])
    expect(patch.crypto.years[2026].lockedMonths).toEqual([])
  })

  it('não apaga snapshots congelados ao reabrir', () => {
    const patch = buildUnlockMonthPatch(locked(), 2026, 5)
    expect(patch.crypto.platforms[0].holdings[0].monthData['2026-5'].price).toBe(42000)
  })

  it('idempotente: sistemas já abertos ficam fora do patch', () => {
    const d = locked()
    d.stocks.years[2026].lockedMonths = []
    const patch = buildUnlockMonthPatch(d, 2026, 5)
    expect(patch.stocks).toBeUndefined()
    expect(patch.years[2026].lockedMonths).toEqual([4])
  })

  it('mês aberto em todo o lado → patch vazio', () => {
    expect(buildUnlockMonthPatch(base(), 2026, 5)).toEqual({})
  })
})

describe('isMonthFullyLocked', () => {
  it('true só quando os três sistemas (com dados) estão fechados', () => {
    const d = base()
    expect(isMonthFullyLocked(d, 2026, 5)).toBe(false)
    d.years[2026].lockedMonths = [5]
    expect(isMonthFullyLocked(d, 2026, 5)).toBe(false) // faltam ações/crypto
    d.stocks.years = { 2026: { lockedMonths: [5] } }
    d.crypto.years = { 2026: { lockedMonths: [5] } }
    expect(isMonthFullyLocked(d, 2026, 5)).toBe(true)
  })

  it('ignora sistemas sem dados (sem crypto → não conta)', () => {
    const d = { years: { 2026: { lockedMonths: [5] } } }
    expect(isMonthFullyLocked(d, 2026, 5)).toBe(true)
  })
})
