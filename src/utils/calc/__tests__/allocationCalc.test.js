import { describe, it, expect } from 'vitest'
import { allocationRows, seedTargetsFromActual } from '../allocationCalc.js'

const cats = [
  { id: 'etfs',   name: 'ETFs',   value: 5000 },
  { id: 'aforro', name: 'Aforro', value: 3000 },
  { id: 'crypto', name: 'Cripto', value: 2000 },
]

describe('allocationRows', () => {
  it('calcula percentagens atuais e desvios em € face ao alvo', () => {
    const { rows, total, sumTargets } = allocationRows(cats, { etfs: 60, aforro: 30, crypto: 10 })
    expect(total).toBe(10000)
    expect(sumTargets).toBe(100)
    const etfs = rows.find(r => r.id === 'etfs')
    expect(etfs.actualPct).toBeCloseTo(50, 6)
    expect(etfs.deltaEur).toBeCloseTo(1000, 6)   // 60% de 10 000 − 5 000
    const crypto = rows.find(r => r.id === 'crypto')
    expect(crypto.deltaEur).toBeCloseTo(-1000, 6) // reduzir
  })

  it('categoria sem alvo tem deltaEur/deltaPct null', () => {
    const { rows } = allocationRows(cats, { etfs: 60 })
    expect(rows.find(r => r.id === 'aforro').deltaEur).toBeNull()
  })

  it('inclui categorias com alvo mas sem valor, exclui sem ambos', () => {
    const { rows } = allocationRows([...cats, { id: 'ppr', name: 'PPR', value: 0 }], { ppr: 15 })
    expect(rows.find(r => r.id === 'ppr')).toBeTruthy()
    const { rows: rows2 } = allocationRows([{ id: 'x', name: 'X', value: 0 }], {})
    expect(rows2).toHaveLength(0)
  })

  it('total 0 → sem desvios em €', () => {
    const { rows, total } = allocationRows([{ id: 'a', name: 'A', value: 0 }], { a: 100 })
    expect(total).toBe(0)
    expect(rows[0].deltaEur).toBeNull()
  })
})

describe('seedTargetsFromActual', () => {
  it('arredonda e força a soma a 100', () => {
    const t = seedTargetsFromActual([
      { id: 'a', value: 3333 }, { id: 'b', value: 3333 }, { id: 'c', value: 3334 },
    ])
    expect(Object.values(t).reduce((s, v) => s + v, 0)).toBe(100)
  })
  it('ignora categorias a zero e devolve {} sem património', () => {
    const t = seedTargetsFromActual([{ id: 'a', value: 100 }, { id: 'b', value: 0 }])
    expect(t).toEqual({ a: 100 })
    expect(seedTargetsFromActual([{ id: 'a', value: 0 }])).toEqual({})
  })
})
