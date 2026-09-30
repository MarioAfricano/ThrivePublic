import { describe, it, expect } from 'vitest'
import {
  isPPRPlatformVisible, getPPRAccData, calcPPRTotal,
  isContribActiveForMK, calcPPRContribTotals,
  getMK,
} from '../initialData.js'

const JAN = getMK(2026, 0)
const FEB = getMK(2026, 1)
const MAR = getMK(2026, 2)
const APR = getMK(2026, 3)

// ── isPPRPlatformVisible ────────────────────────────────────────────
describe('isPPRPlatformVisible', () => {
  it('sem mk é sempre visível', () => {
    expect(isPPRPlatformVisible({}, null)).toBe(true)
    expect(isPPRPlatformVisible({ startMK: MAR }, null)).toBe(true)
  })

  it('startMK no futuro esconde; a partir do próprio startMK mostra', () => {
    const p = { startMK: MAR }
    expect(isPPRPlatformVisible(p, FEB)).toBe(false)
    expect(isPPRPlatformVisible(p, MAR)).toBe(true)
    expect(isPPRPlatformVisible(p, APR)).toBe(true)
  })

  it('deletedFromMK esconde a partir desse mês (inclusive)', () => {
    const p = { deletedFromMK: MAR }
    expect(isPPRPlatformVisible(p, FEB)).toBe(true)
    expect(isPPRPlatformVisible(p, MAR)).toBe(false)
    expect(isPPRPlatformVisible(p, APR)).toBe(false)
  })
})

// ── getPPRAccData ───────────────────────────────────────────────────
describe('getPPRAccData', () => {
  it('devolve monthData[mk] quando existe', () => {
    const acc = { balance: 500, monthData: { [MAR]: { balance: 750, rentabilidade: 0.03 } } }
    expect(getPPRAccData(acc, MAR)).toEqual({ balance: 750, rentabilidade: 0.03 })
  })

  it('fallback para balance de raiz quando não há monthData', () => {
    const acc = { balance: 500 }
    expect(getPPRAccData(acc, MAR)).toEqual({ balance: 500 })
  })

  it('acc.balance ausente → devolve balance 0', () => {
    expect(getPPRAccData({}, MAR)).toEqual({ balance: 0 })
  })

  it('sem mk devolve balance de raiz', () => {
    expect(getPPRAccData({ balance: 300 }, null)).toEqual({ balance: 300 })
  })
})

// ── calcPPRTotal ────────────────────────────────────────────────────
describe('calcPPRTotal', () => {
  it('soma balance de todas as contas de todas as plataformas visíveis', () => {
    const platforms = [
      { id: 'p1', accounts: [
        { id: 'a1', balance: 1000 },
        { id: 'a2', balance: 500 },
      ]},
      { id: 'p2', accounts: [{ id: 'a3', balance: 2000 }] },
    ]
    expect(calcPPRTotal(platforms, null)).toBe(3500)
  })

  it('respeita isPPRPlatformVisible (filtra startMK / deletedFromMK)', () => {
    const platforms = [
      { id: 'p1', accounts: [{ id: 'a1', balance: 100 }] },
      { id: 'p2', startMK: APR, accounts: [{ id: 'a2', balance: 999 }] },       // futuro em MAR
      { id: 'p3', deletedFromMK: MAR, accounts: [{ id: 'a3', balance: 888 }] },  // apagada em MAR
    ]
    expect(calcPPRTotal(platforms, MAR)).toBe(100)
  })

  it('usa monthData[mk].balance quando disponível em vez do balance de raiz', () => {
    const platforms = [{ id: 'p1', accounts: [
      { id: 'a1', balance: 100, monthData: { [MAR]: { balance: 999 } } },
    ]}]
    expect(calcPPRTotal(platforms, MAR)).toBe(999)
  })

  it('lista vazia devolve 0', () => {
    expect(calcPPRTotal([], null)).toBe(0)
    expect(calcPPRTotal(null, null)).toBe(0)
  })
})

// ── isContribActiveForMK — regra dos dias ───────────────────────────
describe('isContribActiveForMK', () => {
  it('dia <= 1: conta no próprio mês', () => {
    const c = { mk: FEB, day: 1 }
    expect(isContribActiveForMK(c, JAN)).toBe(false)
    expect(isContribActiveForMK(c, FEB)).toBe(true)
    expect(isContribActiveForMK(c, MAR)).toBe(true)
  })

  it('day ausente é tratado como 1', () => {
    const c = { mk: FEB }
    expect(isContribActiveForMK(c, FEB)).toBe(true)
  })

  it('dia > 1: só conta a partir do mês seguinte', () => {
    const c = { mk: FEB, day: 15 }
    expect(isContribActiveForMK(c, FEB)).toBe(false) // próprio mês da contribuição
    expect(isContribActiveForMK(c, MAR)).toBe(true)
    expect(isContribActiveForMK(c, APR)).toBe(true)
  })

  it('borda de ano: Dez dia > 1 propaga para Jan do ano seguinte', () => {
    const c = { mk: getMK(2026, 11), day: 20 }
    expect(isContribActiveForMK(c, getMK(2026, 11))).toBe(false)
    expect(isContribActiveForMK(c, getMK(2027, 0))).toBe(true)
  })
})

// ── calcPPRContribTotals ────────────────────────────────────────────
describe('calcPPRContribTotals', () => {
  function platforms() {
    return [{ id: 'p1', accounts: [{ id: 'a1', contributions: [
      { id: 'c1', mk: JAN, day: 1,  valorPago: 100, valorColocado: 95 },  // entrega Jan
      { id: 'c2', mk: FEB, day: 15, valorPago: 200, valorColocado: 190 }, // só conta em Mar
      { id: 'c3', mk: MAR, day: 1,  valorPago: 300, valorColocado: 285 }, // entrega Mar
      { id: 'c4', mk: MAR, day: 10, valorPago: -50, valorColocado: -50 }, // levantamento Mar dia 10 → Abr
    ]}]}]
  }

  it('sem mk inclui todas as contribuições', () => {
    const res = calcPPRContribTotals(platforms(), null)
    expect(res.pago).toBe(100 + 200 + 300 - 50)
    expect(res.colocado).toBe(95 + 190 + 285 - 50)
    expect(res.countEntregas).toBe(3)
    expect(res.countLevantamentos).toBe(1)
  })

  it('filtra por mk respeitando a regra dos dias', () => {
    // Em FEB: só c1 (Jan, dia 1) está activa
    const feb = calcPPRContribTotals(platforms(), FEB)
    expect(feb.pago).toBe(100)
    expect(feb.colocado).toBe(95)
    expect(feb.countEntregas).toBe(1)
    expect(feb.countLevantamentos).toBe(0)

    // Em MAR: c1 (Jan d1), c2 (Feb d15 → Mar), c3 (Mar d1). c4 (Mar d10 → Abr) não.
    const mar = calcPPRContribTotals(platforms(), MAR)
    expect(mar.pago).toBe(100 + 200 + 300)
    expect(mar.countEntregas).toBe(3)
    expect(mar.countLevantamentos).toBe(0)

    // Em APR: tudo
    const apr = calcPPRContribTotals(platforms(), APR)
    expect(apr.pago).toBe(100 + 200 + 300 - 50)
    expect(apr.countLevantamentos).toBe(1)
  })

  it('encargos = pago - colocado (custos/comissões)', () => {
    const res = calcPPRContribTotals(platforms(), null)
    expect(res.encargos).toBeCloseTo((100 + 200 + 300 - 50) - (95 + 190 + 285 - 50), 6)
  })

  it('lista vazia devolve zeros', () => {
    const res = calcPPRContribTotals([], null)
    expect(res).toEqual({ pago: 0, colocado: 0, encargos: 0, countEntregas: 0, countLevantamentos: 0 })
  })
})
