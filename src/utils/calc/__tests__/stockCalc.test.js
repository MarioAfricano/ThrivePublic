import { describe, it, expect } from 'vitest'
import {
  bolsoInvestidoAtMk, holdingAdjustedStats, effectiveGasto, STOCK_TAX_RATE, stockTaxDue,
  holdingRateToEUR, calcHoldingValue,
} from '../stockCalc.js'
import { getMK } from '../../dateUtils.js'

// ── FX nos valores (holdingRateToEUR / calcHoldingValue) ────────────
describe('holdingRateToEUR / FX nos valores', () => {
  const usd = {
    id: 'hx', ticker: 'NKE', currency: 'USD',
    lots: [{ id: 'l1', buyMk: '2025-0', qty: 10, gasto: 900 }],
    price: 100,
    monthData: { '2025-5': { price: 95, qty: 10, rateToEUR: 0.90 } },
  }
  const rates = { USD: 0.92 }

  it('EUR devolve sempre 1', () => {
    expect(holdingRateToEUR({ currency: 'EUR' }, null, rates)).toBe(1.0)
    expect(holdingRateToEUR({}, null, rates)).toBe(1.0)
  })

  it('prioridade: taxa congelada > live > 1', () => {
    expect(holdingRateToEUR(usd, '2025-5', rates)).toBe(0.90)  // congelada no snapshot
    expect(holdingRateToEUR(usd, '2025-8', rates)).toBe(0.92)  // sem snapshot → live
    expect(holdingRateToEUR(usd, null, null)).toBe(1.0)        // sem nada → 1
  })

  it('valor live em EUR aplica o câmbio live', () => {
    expect(calcHoldingValue(usd, null, rates)).toBeCloseTo(10 * 100 * 0.92, 6)
  })

  it('valor histórico usa preço E câmbio congelados', () => {
    expect(calcHoldingValue(usd, '2025-5', rates)).toBeCloseTo(10 * 95 * 0.90, 6)
  })

  it('sem liveRates mantém o comportamento antigo (×1)', () => {
    expect(calcHoldingValue(usd, null)).toBeCloseTo(1000, 6)
  })
})

// ── Fixtures ────────────────────────────────────────────────────────
const MK_JAN = getMK(2026, 0)
const MK_FEB = getMK(2026, 1)
const MK_MAR = getMK(2026, 2)
const MK_APR = getMK(2026, 3)

function holding(overrides = {}) {
  return { id: 'h1', ticker: 'AAA', currency: 'EUR', price: 10, lots: [], ...overrides }
}

// ── Constante IRS ───────────────────────────────────────────────────
describe('STOCK_TAX_RATE / stockTaxDue', () => {
  it('taxa IRS é 28%', () => {
    expect(STOCK_TAX_RATE).toBe(0.28)
  })
  it('stockTaxDue aplica 28% a ganho positivo', () => {
    expect(stockTaxDue(1000)).toBeCloseTo(280, 8)
  })
  it('stockTaxDue é 0 para ganho zero ou negativo (perda)', () => {
    expect(stockTaxDue(0)).toBe(0)
    expect(stockTaxDue(-500)).toBe(0)
  })
})

// ── bolsoInvestidoAtMk ──────────────────────────────────────────────
describe('bolsoInvestidoAtMk', () => {
  it('sem entregas devolve valorInvestido como fallback', () => {
    expect(bolsoInvestidoAtMk({ valorInvestido: 500 }, MK_FEB)).toBe(500)
    expect(bolsoInvestidoAtMk({}, MK_FEB)).toBe(0)
  })

  it('entregas no dia 1 contam a partir desse mês', () => {
    const bolso = { entregas: [
      { id: 'e1', date: '2026-02-01', amount: 100 }, // Feb dia 1 → conta em Feb
    ]}
    expect(bolsoInvestidoAtMk(bolso, MK_JAN)).toBe(0)
    expect(bolsoInvestidoAtMk(bolso, MK_FEB)).toBe(100)
    expect(bolsoInvestidoAtMk(bolso, MK_MAR)).toBe(100)
  })

  it('entregas após o dia 1 só contam a partir do mês seguinte', () => {
    const bolso = { entregas: [
      { id: 'e1', date: '2026-02-15', amount: 200 }, // Feb dia 15 → conta só a partir de Mar
    ]}
    expect(bolsoInvestidoAtMk(bolso, MK_FEB)).toBe(0)
    expect(bolsoInvestidoAtMk(bolso, MK_MAR)).toBe(200)
    expect(bolsoInvestidoAtMk(bolso, MK_APR)).toBe(200)
  })

  it('borda de ano: Dezembro dia > 1 propaga para Janeiro do ano seguinte', () => {
    const bolso = { entregas: [
      { id: 'e1', date: '2026-12-15', amount: 50 },
    ]}
    expect(bolsoInvestidoAtMk(bolso, getMK(2026, 11))).toBe(0) // Dez 2026
    expect(bolsoInvestidoAtMk(bolso, getMK(2027, 0))).toBe(50)  // Jan 2027
  })

  it('mistura de entregas (dia 1 + após dia 1) acumula corretamente por mês', () => {
    const bolso = { entregas: [
      { id: 'e1', date: '2026-01-01', amount: 100 }, // Jan dia 1 → Jan
      { id: 'e2', date: '2026-02-20', amount: 300 }, // Feb dia 20 → Mar
      { id: 'e3', date: '2026-03-01', amount: 200 }, // Mar dia 1 → Mar
    ]}
    expect(bolsoInvestidoAtMk(bolso, MK_JAN)).toBe(100)
    expect(bolsoInvestidoAtMk(bolso, MK_FEB)).toBe(100)
    expect(bolsoInvestidoAtMk(bolso, MK_MAR)).toBe(100 + 300 + 200)
  })

  it('sem data na entrega ou sem mk, todas contam (fallback laxo)', () => {
    const bolso = { entregas: [
      { id: 'e1', amount: 100 },
      { id: 'e2', amount: 50 },
    ]}
    expect(bolsoInvestidoAtMk(bolso, null)).toBe(150)
    expect(bolsoInvestidoAtMk(bolso, MK_FEB)).toBe(150)
  })
})

// ── holdingAdjustedStats ────────────────────────────────────────────
describe('holdingAdjustedStats — sem sell lots', () => {
  it('sem lots devolve gasto de raiz + realizedProfit=0', () => {
    const h = holding({ gasto: 500 })
    const res = holdingAdjustedStats(h, null)
    expect(res.realizedProfit).toBe(0)
    expect(res.adjustedGasto).toBe(500)
  })

  it('com lots (só compras) o gasto ajustado é o holdingGastoAtMk', () => {
    const h = holding({ lots: [
      { id: 'l1', qty: 10, gasto: 100, buyMk: MK_JAN },
      { id: 'l2', qty: 5,  gasto: 75,  buyMk: MK_FEB },
    ]})
    // Até Mar inclusive: ambos os lots contaram (ambos < Mar no mk-number)
    const res = holdingAdjustedStats(h, MK_MAR)
    expect(res.realizedProfit).toBe(0)
    expect(res.adjustedGasto).toBe(100 + 75)
  })
})

describe('holdingAdjustedStats — com vendas parciais (custo médio)', () => {
  it('custo médio ponderado: 2 compras a preços diferentes, venda parcial', () => {
    // Compra 1 (Jan): 10 @ 10€ = 100€
    // Compra 2 (Feb): 10 @ 20€ = 200€
    // Total: 20 unidades, gasto 300€ → avgCost = 15€/un
    // Venda (Mar): qty -5, sellTotal 125 → proceeds 125€, custo 5×15=75€ → realizedProfit = 50€
    // Restante em Abril: 15 unidades → adjustedGasto = 15×15 = 225€
    // (Convenção do data model: sell lots têm qty NEGATIVA, veja Acoes.jsx:1470.)
    const h = holding({ lots: [
      { id: 'b1', qty: 10, gasto: 100, buyMk: MK_JAN },
      { id: 'b2', qty: 10, gasto: 200, buyMk: MK_FEB },
      { id: 's1', qty: -5, sellTotal: 125, isSell: true, buyMk: MK_MAR },
    ]})
    const res = holdingAdjustedStats(h, MK_APR)
    expect(res.realizedProfit).toBeCloseTo(50, 6)
    expect(res.adjustedGasto).toBeCloseTo(225, 6)
  })

  it('venda com perda devolve realizedProfit negativo', () => {
    const h = holding({ lots: [
      { id: 'b1', qty: 10, gasto: 200, buyMk: MK_JAN }, // avg 20€/un
      { id: 's1', qty: -4, sellTotal: 60, isSell: true, buyMk: MK_FEB }, // vendeu 4 a 15 → proceeds 60, custo 80
    ]})
    const res = holdingAdjustedStats(h, MK_MAR)
    expect(res.realizedProfit).toBeCloseTo(-20, 6)
    expect(res.adjustedGasto).toBeCloseTo(6 * 20, 6) // 6 unidades restantes × 20
  })

  it('venda total zera adjustedGasto mas preserva realizedProfit', () => {
    const h = holding({ lots: [
      { id: 'b1', qty: 10,  gasto: 100, buyMk: MK_JAN },
      { id: 's1', qty: -10, sellTotal: 150, isSell: true, buyMk: MK_FEB },
    ]})
    const res = holdingAdjustedStats(h, MK_MAR)
    expect(res.realizedProfit).toBeCloseTo(50, 6)
    expect(res.adjustedGasto).toBe(0)
  })

  it('sell lot no futuro não conta para o mk pedido', () => {
    const h = holding({ lots: [
      { id: 'b1', qty: 10, gasto: 100, buyMk: MK_JAN },
      { id: 's1', qty: -5, sellTotal: 75, isSell: true, buyMk: MK_APR },
    ]})
    // A pedir MK_FEB, a venda de Abril ainda não aconteceu → não há realizedProfit
    const res = holdingAdjustedStats(h, MK_FEB)
    expect(res.realizedProfit).toBe(0)
    // Mas como há sell lots em geral no holding, entra no branch com custo médio
    // avgCost = 10€/un, remainingQty em MK_FEB = 10 (sell ainda não aconteceu)
    expect(res.adjustedGasto).toBeCloseTo(100, 6)
  })
})

// ── effectiveGasto (override manual) ────────────────────────────────
describe('effectiveGasto — override manual por mês', () => {
  it('sem override devolve adjustedGasto', () => {
    const h = holding({ lots: [{ id: 'b1', qty: 10, gasto: 100, buyMk: MK_JAN }]})
    expect(effectiveGasto(h, MK_MAR)).toBe(100)
  })

  it('usa o override mais recente ≤ mk', () => {
    // Compra em MK_JAN → só entra no gasto a partir de MK_FEB (regra do mês seguinte).
    const h = holding({
      lots: [{ id: 'b1', qty: 10, gasto: 100, buyMk: MK_JAN }],
      gastoOverrideByMk: {
        [MK_MAR]: 150,
        [MK_APR]: 200,
      },
    })
    expect(effectiveGasto(h, MK_FEB)).toBe(100) // antes de qualquer override (gasto adjustado cru)
    expect(effectiveGasto(h, MK_MAR)).toBe(150)
    expect(effectiveGasto(h, MK_APR)).toBe(200)
  })

  it('sem mk devolve adjustedGasto (ignora overrides)', () => {
    const h = holding({
      lots: [{ id: 'b1', qty: 10, gasto: 100, buyMk: MK_JAN }],
      gastoOverrideByMk: { [MK_FEB]: 999 },
    })
    expect(effectiveGasto(h, null)).toBe(100)
  })
})
