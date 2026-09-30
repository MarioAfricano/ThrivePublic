import { describe, it, expect } from 'vitest'
import {
  getMK, mkToNum, compareMK,
  mkToMonthInput, monthInputToMk,
  addMonthsToMk, addMonthsToDate,
} from '../dateUtils.js'

describe('getMK / mkToNum', () => {
  it('constrói mk com mês 0-indexed', () => {
    expect(getMK(2026, 0)).toBe('2026-0')
    expect(getMK(2026, 11)).toBe('2026-11')
  })

  it('mkToNum dá um inteiro comparável', () => {
    expect(mkToNum('2026-0')).toBe(202600)
    expect(mkToNum('2026-11')).toBe(202611)
    expect(mkToNum(null)).toBe(0)
  })

  it('mkToNum preserva ordenação cronológica', () => {
    expect(mkToNum('2025-11') < mkToNum('2026-0')).toBe(true)
    expect(mkToNum('2025-1')  < mkToNum('2025-10')).toBe(true) // armadilha de string-compare
  })
})

describe('compareMK', () => {
  it('devolve <0 quando a < b, >0 quando a > b, 0 igual', () => {
    expect(compareMK('2026-1', '2026-2')).toBeLessThan(0)
    expect(compareMK('2026-2', '2026-1')).toBeGreaterThan(0)
    expect(compareMK('2026-5', '2026-5')).toBe(0)
  })

  it('lida com bordas de ano', () => {
    expect(compareMK('2025-11', '2026-0')).toBeLessThan(0)
    expect(compareMK('2026-0',  '2025-11')).toBeGreaterThan(0)
  })
})

describe('mkToMonthInput / monthInputToMk — roundtrip', () => {
  it('mkToMonthInput aplica 1-indexed e zero-padding', () => {
    expect(mkToMonthInput('2026-0')).toBe('2026-01')
    expect(mkToMonthInput('2026-8')).toBe('2026-09')
    expect(mkToMonthInput('2026-11')).toBe('2026-12')
  })

  it('monthInputToMk aplica 0-indexed', () => {
    expect(monthInputToMk('2026-01')).toBe('2026-0')
    expect(monthInputToMk('2026-12')).toBe('2026-11')
  })

  it('é roundtrip estável em todos os meses', () => {
    for (let m = 0; m < 12; m++) {
      const mk = getMK(2026, m)
      expect(monthInputToMk(mkToMonthInput(mk))).toBe(mk)
    }
  })

  it('valores vazios/nulos devolvem vazio/null', () => {
    expect(mkToMonthInput(null)).toBe('')
    expect(mkToMonthInput('')).toBe('')
    expect(monthInputToMk(null)).toBe(null)
    expect(monthInputToMk('')).toBe(null)
  })
})

describe('addMonthsToMk', () => {
  it('adiciona meses dentro do ano', () => {
    expect(addMonthsToMk('2026-3', 2)).toBe('2026-5')
  })

  it('propaga para o ano seguinte', () => {
    expect(addMonthsToMk('2026-11', 1)).toBe('2027-0')
    expect(addMonthsToMk('2026-10', 5)).toBe('2027-3')
  })

  it('suporta N negativo', () => {
    expect(addMonthsToMk('2026-0', -1)).toBe('2025-11')
    expect(addMonthsToMk('2026-3', -6)).toBe('2025-9')
  })
})

describe('addMonthsToDate', () => {
  it('adiciona 1 mês a um dia que existe em ambos os meses', () => {
    expect(addMonthsToDate('2026-04-15', 1)).toBe('2026-05-15')
  })

  it('clampa dia 31 → último dia do mês mais curto', () => {
    // 31 de Jan + 1 mês = 28 ou 29 de Fev. 2026 não é bissexto.
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('lida com ano bissexto', () => {
    expect(addMonthsToDate('2024-01-31', 1)).toBe('2024-02-29')
  })
})
