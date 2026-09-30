import { describe, it, expect } from 'vitest'
import {
  CATEGORY_IDS, CATEGORY_STACK_IDS, CATEGORY_LABELS, CATEGORY_DEFAULT_COLORS,
  isValidCategoryColor, getCategoryColors, getCategoryColor, getCategoryDefs,
} from '../categories.js'

describe('definições de categorias', () => {
  it('as duas ordens cobrem exactamente as mesmas categorias', () => {
    expect([...CATEGORY_IDS].sort()).toEqual([...CATEGORY_STACK_IDS].sort())
  })

  it('toda a categoria tem rótulo e cor por omissão', () => {
    for (const id of CATEGORY_IDS) {
      expect(CATEGORY_LABELS[id]).toBeTruthy()
      expect(isValidCategoryColor(CATEGORY_DEFAULT_COLORS[id])).toBe(true)
    }
  })

  it('as cores por omissão são todas distintas', () => {
    const cores = CATEGORY_IDS.map(id => CATEGORY_DEFAULT_COLORS[id])
    expect(new Set(cores).size).toBe(cores.length)
  })
})

describe('isValidCategoryColor', () => {
  it('aceita hex de 6 dígitos', () => {
    expect(isValidCategoryColor('#ff0066')).toBe(true)
    expect(isValidCategoryColor('#FF0066')).toBe(true)
  })

  it('rejeita tudo o resto', () => {
    for (const v of ['#f06', 'ff0066', 'red', 'rgb(1,2,3)', '', null, undefined, 123, {}]) {
      expect(isValidCategoryColor(v)).toBe(false)
    }
  })
})

describe('getCategoryColors', () => {
  it('sem dados devolve os defaults', () => {
    expect(getCategoryColors(null)).toEqual(CATEGORY_DEFAULT_COLORS)
    expect(getCategoryColors({})).toEqual(CATEGORY_DEFAULT_COLORS)
  })

  it('a personalização sobrepõe-se, o resto fica no default', () => {
    const c = getCategoryColors({ categoryColors: { etfs: '#ff0066' } })
    expect(c.etfs).toBe('#ff0066')
    expect(c.banco).toBe(CATEGORY_DEFAULT_COLORS.banco)
  })

  it('ignora cores inválidas e cai no default', () => {
    const c = getCategoryColors({ categoryColors: { etfs: 'azul', ppr: '#zzz' } })
    expect(c.etfs).toBe(CATEGORY_DEFAULT_COLORS.etfs)
    expect(c.ppr).toBe(CATEGORY_DEFAULT_COLORS.ppr)
  })

  it('ignora ids desconhecidos', () => {
    const c = getCategoryColors({ categoryColors: { inexistente: '#ff0066' } })
    expect(c.inexistente).toBeUndefined()
    expect(Object.keys(c).sort()).toEqual([...CATEGORY_IDS].sort())
  })

  it('não muta os defaults entre chamadas', () => {
    getCategoryColors({ categoryColors: { etfs: '#ff0066' } })
    expect(CATEGORY_DEFAULT_COLORS.etfs).toBe('#22d3ee')
    expect(getCategoryColors(null).etfs).toBe('#22d3ee')
  })
})

describe('getCategoryColor', () => {
  it('devolve a cor de uma categoria', () => {
    expect(getCategoryColor({ categoryColors: { banco: '#00e5a0' } }, 'banco')).toBe('#00e5a0')
    expect(getCategoryColor(null, 'banco')).toBe(CATEGORY_DEFAULT_COLORS.banco)
  })
})

describe('getCategoryDefs', () => {
  it('respeita a ordem pedida', () => {
    expect(getCategoryDefs(null).map(d => d.id)).toEqual(CATEGORY_IDS)
    expect(getCategoryDefs(null, CATEGORY_STACK_IDS).map(d => d.id)).toEqual(CATEGORY_STACK_IDS)
  })

  it('expõe id e key com o mesmo valor (consumidores usam ambos)', () => {
    for (const d of getCategoryDefs(null)) expect(d.key).toBe(d.id)
  })

  it('aplica as cores personalizadas', () => {
    const defs = getCategoryDefs({ categoryColors: { acoes: '#ffd400' } })
    expect(defs.find(d => d.id === 'acoes').color).toBe('#ffd400')
  })
})
