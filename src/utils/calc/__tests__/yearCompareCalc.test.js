import { describe, it, expect } from 'vitest'
import { lastSnapshotOfYear, compareYearSnaps, COMPARE_CATEGORIES } from '../yearCompareCalc.js'

describe('lastSnapshotOfYear', () => {
  const years = {
    2025: { months: { 3: { banco: 1 }, 11: { banco: 2 } } },
    2026: { months: { 5: { banco: 3 } } },
  }
  it('devolve o mês mais tardio com snapshot', () => {
    expect(lastSnapshotOfYear(years, 2025)).toEqual({ m: 11, snap: { banco: 2 } })
    expect(lastSnapshotOfYear(years, 2026)).toEqual({ m: 5, snap: { banco: 3 } })
  })
  it('null sem snapshots', () => {
    expect(lastSnapshotOfYear(years, 2024)).toBeNull()
    expect(lastSnapshotOfYear(null, 2025)).toBeNull()
  })
})

describe('compareYearSnaps', () => {
  const a = { banco: 1000, poupanca: 5000, etfs: 2000 }
  const b = { banco: 1500, poupanca: 6000, etfs: 1500, crypto: 300 }

  it('delta e pct por categoria', () => {
    const { rows } = compareYearSnaps(a, b)
    const poup = rows.find(r => r.id === 'poupanca')
    expect(poup.delta).toBe(1000)
    expect(poup.pct).toBeCloseTo(0.2, 6)
    const etfs = rows.find(r => r.id === 'etfs')
    expect(etfs.delta).toBe(-500)
  })

  it('pct null quando a base é 0 (categoria nova)', () => {
    const { rows } = compareYearSnaps(a, b)
    const cr = rows.find(r => r.id === 'crypto')
    expect(cr.delta).toBe(300)
    expect(cr.pct).toBeNull()
  })

  it('totais coerentes', () => {
    const cmp = compareYearSnaps(a, b)
    expect(cmp.totalA).toBe(8000)
    expect(cmp.totalB).toBe(9300)
    expect(cmp.delta).toBe(1300)
    expect(cmp.pct).toBeCloseTo(1300 / 8000, 6)
  })

  it('robusto a snapshots null', () => {
    const cmp = compareYearSnaps(null, null)
    expect(cmp.totalA).toBe(0)
    expect(cmp.pct).toBeNull()
    expect(cmp.rows).toHaveLength(COMPARE_CATEGORIES.length)
  })
})
