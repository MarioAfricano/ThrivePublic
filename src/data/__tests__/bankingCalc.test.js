import { describe, it, expect } from 'vitest'
import {
  calcBancoTotal, calcSavingsTotal, platformTotal,
  isAccVisible, getAccData, getMK,
} from '../initialData.js'

// ── Helpers para criar fixtures ──────────────────────────────────
function acc(overrides = {}) {
  return {
    id: 'a1',
    type: 'conta',
    currency: 'EUR',
    balance: 0,
    interest: 0,
    monthData: {},
    ...overrides,
  }
}
function plat(accounts) { return { id: 'p1', name: 'Banco X', accounts } }

const MK_APR = getMK(2026, 3) // Abril 2026
const MK_MAY = getMK(2026, 4)

describe('isAccVisible', () => {
  it('conta sem restrições é sempre visível', () => {
    expect(isAccVisible(acc(), MK_APR)).toBe(true)
    expect(isAccVisible(acc(), null)).toBe(true)
  })

  it('startMK no futuro esconde a conta', () => {
    const a = acc({ startMK: getMK(2026, 5) })
    expect(isAccVisible(a, MK_APR)).toBe(false)
    expect(isAccVisible(a, getMK(2026, 5))).toBe(true)  // visível no próprio startMK
    expect(isAccVisible(a, getMK(2026, 6))).toBe(true)
  })

  it('deletedFromMK esconde a partir desse mês (inclusive)', () => {
    const a = acc({ deletedFromMK: MK_MAY })
    expect(isAccVisible(a, MK_APR)).toBe(true)
    expect(isAccVisible(a, MK_MAY)).toBe(false) // <= mk → escondida
    expect(isAccVisible(a, getMK(2026, 6))).toBe(false)
  })
})

describe('getAccData', () => {
  it('devolve monthData[mk] quando existe', () => {
    const a = acc({ balance: 100, monthData: { [MK_APR]: { balance: 250, interest: 5, rateToEUR: 0.9 } } })
    expect(getAccData(a, MK_APR)).toEqual({ balance: 250, interest: 5, rateToEUR: 0.9 })
  })

  it('fallback para campos de raiz quando mk não tem data', () => {
    const a = acc({ balance: 100, interest: 3 })
    expect(getAccData(a, MK_APR)).toEqual({
      balance: 100, interest: 3, interestHistory: [], rateToEUR: 1.0,
    })
  })

  it('sem mk devolve sempre os campos de raiz', () => {
    const a = acc({ balance: 50, monthData: { [MK_APR]: { balance: 999 } } })
    expect(getAccData(a, null).balance).toBe(50)
  })
})

describe('calcBancoTotal — contas à ordem (type="conta")', () => {
  it('soma só o balance (sem juros) de contas tipo "conta"', () => {
    const platforms = [plat([
      acc({ id: 'a1', type: 'conta',    balance: 1000, interest: 50 }),
      acc({ id: 'a2', type: 'poupanca', balance: 500,  interest: 20 }),
    ])]
    // Só conta "conta" → 1000, sem os 50 de juros
    expect(calcBancoTotal(platforms, null)).toBe(1000)
  })

  it('converte moeda com liveRates', () => {
    const platforms = [plat([
      acc({ currency: 'USD', balance: 100 }),
    ])]
    expect(calcBancoTotal(platforms, null, { USD: 0.92 })).toBeCloseTo(92, 8)
  })

  it('usa monthData[mk] em vez do balance de raiz quando há snapshot', () => {
    const platforms = [plat([
      acc({ balance: 100, monthData: { [MK_APR]: { balance: 250 } } }),
    ])]
    expect(calcBancoTotal(platforms, MK_APR)).toBe(250)
  })

  it('respeita visibilidade (contas apagadas não entram)', () => {
    const platforms = [plat([
      acc({ id: 'ativa',   balance: 100 }),
      acc({ id: 'apagada', balance: 999, deletedFromMK: MK_APR }),
    ])]
    expect(calcBancoTotal(platforms, MK_APR)).toBe(100)
  })
})

describe('calcSavingsTotal — poupanças', () => {
  it('inclui balance + interest para contas com type !== "conta"', () => {
    const platforms = [plat([
      acc({ type: 'poupanca',          balance: 1000, interest: 50 }),
      acc({ type: 'poupanca_desconto', balance: 500,  interest: 20 }),
    ])]
    expect(calcSavingsTotal(platforms, null)).toBe(1000 + 50 + 500 + 20)
  })

  it('exclui contas "conta"', () => {
    const platforms = [plat([
      acc({ type: 'conta',    balance: 99999 }),
      acc({ type: 'poupanca', balance: 200, interest: 10 }),
    ])]
    expect(calcSavingsTotal(platforms, null)).toBe(210)
  })
})

describe('platformTotal — total agregado de uma plataforma', () => {
  it('soma balance + interest de todas as contas visíveis', () => {
    const p = plat([
      acc({ type: 'conta',    balance: 1000, interest: 0 }),
      acc({ type: 'poupanca', balance: 500,  interest: 20 }),
    ])
    expect(platformTotal(p, null)).toBe(1000 + 500 + 20)
  })

  it('respeita deletedFromMK', () => {
    const p = plat([
      acc({ balance: 100 }),
      acc({ balance: 999, deletedFromMK: MK_APR }),
    ])
    expect(platformTotal(p, MK_APR)).toBe(100)
  })
})

// ── Bordas mês aberto/fechado com taxa de câmbio ────────────────
describe('borda locked/live em câmbios', () => {
  it('mês aberto: liveRates sobrepõe monthData.rateToEUR no cálculo bancário', () => {
    // 100 USD guardados com rateToEUR 0.85 (antigo). Live hoje é 0.92.
    // A função actual NÃO distingue locked: usa sempre live quando disponível.
    const platforms = [plat([
      acc({
        currency: 'USD',
        balance: 0,
        monthData: { [MK_APR]: { balance: 100, rateToEUR: 0.85 } },
      }),
    ])]
    const live = { USD: 0.92 }
    expect(calcBancoTotal(platforms, MK_APR, live)).toBeCloseTo(92, 8)
  })

  it('sem liveRates: cai para a taxa guardada no monthData', () => {
    const platforms = [plat([
      acc({
        currency: 'USD',
        monthData: { [MK_APR]: { balance: 100, rateToEUR: 0.85 } },
      }),
    ])]
    expect(calcBancoTotal(platforms, MK_APR, null)).toBeCloseTo(85, 8)
  })

  it('moeda EUR nunca é convertida mesmo com liveRates', () => {
    const platforms = [plat([
      acc({ currency: 'EUR', balance: 100 }),
    ])]
    expect(calcBancoTotal(platforms, null, { EUR: 999, USD: 0.9 })).toBe(100)
  })
})
