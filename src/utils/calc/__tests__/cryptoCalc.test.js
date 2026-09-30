import { describe, it, expect } from 'vitest'
import {
  CRYPTO_IRS_RATE, CRYPTO_TAX_FREE_DAYS,
  daysSince, isLotExempt, daysUntilExempt,
  holdingQty, holdingGasto, holdingValue, holdingProfit,
  holdingTaxBreakdown, simulateSale, executeSale,
  lotMK, lotExistsAtMk,
  holdingQtyAtMk, holdingGastoAtMk, holdingValueAtMk, holdingProfitAtMk,
  calcCryptoTotal,
} from '../cryptoCalc.js'
import { getMK } from '../../dateUtils.js'

// ── Fixtures ────────────────────────────────────────────────────────
// Fixamos uma "agora" para os testes (independente do relógio real)
const NOW = new Date('2026-06-15T12:00:00Z').getTime()

// Datas úteis:
const DATE_OVER_1Y    = '2025-01-10' // > 365 dias → isento
const DATE_RECENT     = '2026-03-10' // < 365 dias → tributável
const DATE_YESTERDAY  = '2026-06-14' // < 365 dias → tributável

function lot(o = {}) {
  return { id: 'L', qty: 1, gasto: 100, buyDate: DATE_RECENT, ...o }
}
function holding(o = {}) {
  return { id: 'h1', ticker: 'BTC', price: 100, lots: [], ...o }
}

// ── Constantes ──────────────────────────────────────────────────────
describe('constantes', () => {
  it('IRS_RATE = 28%', () => { expect(CRYPTO_IRS_RATE).toBe(0.28) })
  it('TAX_FREE_DAYS = 365', () => { expect(CRYPTO_TAX_FREE_DAYS).toBe(365) })
})

// ── daysSince / isLotExempt / daysUntilExempt ───────────────────────
describe('daysSince / isLotExempt / daysUntilExempt', () => {
  it('daysSince é zero para data vazia', () => {
    expect(daysSince(null, NOW)).toBe(0)
    expect(daysSince('', NOW)).toBe(0)
  })

  it('daysSince calcula dias entre datas', () => {
    // 2025-06-15 até 2026-06-15 = 365 dias
    expect(daysSince('2025-06-15T12:00:00Z', NOW)).toBe(365)
    // 2026-06-14 até 2026-06-15 = 1 dia
    expect(daysSince('2026-06-14T12:00:00Z', NOW)).toBe(1)
  })

  it('isLotExempt: ≥ 365 dias é isento', () => {
    expect(isLotExempt({ buyDate: DATE_OVER_1Y }, NOW)).toBe(true)
    expect(isLotExempt({ buyDate: '2025-06-15T12:00:00Z' }, NOW)).toBe(true) // exactamente 365
    expect(isLotExempt({ buyDate: DATE_YESTERDAY }, NOW)).toBe(false)
  })

  it('daysUntilExempt nunca é negativo', () => {
    expect(daysUntilExempt({ buyDate: DATE_OVER_1Y }, NOW)).toBe(0)
    // DATE_YESTERDAY (1 dia antes de NOW) → faltam 364 dias
    expect(daysUntilExempt({ buyDate: DATE_YESTERDAY }, NOW)).toBe(364)
  })
})

// ── Totais sem mês ──────────────────────────────────────────────────
describe('holdingQty / holdingGasto / holdingValue / holdingProfit', () => {
  it('soma qty e gasto de todos os lots', () => {
    const h = holding({ price: 50, lots: [
      lot({ qty: 2, gasto: 80 }),
      lot({ qty: 3, gasto: 120 }),
    ]})
    expect(holdingQty(h)).toBe(5)
    expect(holdingGasto(h)).toBe(200)
    expect(holdingValue(h)).toBe(5 * 50)
    expect(holdingProfit(h)).toBe(250 - 200)
  })

  it('lida com holding vazio', () => {
    expect(holdingQty({ lots: [] })).toBe(0)
    expect(holdingGasto({})).toBe(0)
    expect(holdingProfit({ price: 10, lots: [] })).toBe(0)
  })
})

// ── holdingTaxBreakdown ─────────────────────────────────────────────
describe('holdingTaxBreakdown — regime PT: < 1 ano = 28%, ≥ 1 ano = isento', () => {
  it('todos os lots ≥ 1 ano: isFullyExempt, taxDue = 0', () => {
    const h = holding({ price: 200, lots: [
      lot({ qty: 2, gasto: 100, buyDate: DATE_OVER_1Y }),
    ]})
    const bd = holdingTaxBreakdown(h, NOW)
    expect(bd.isFullyExempt).toBe(true)
    expect(bd.isFullyTaxable).toBe(false)
    expect(bd.taxDue).toBe(0)
    expect(bd.exemptValue).toBe(2 * 200)
  })

  it('todos os lots < 1 ano: isFullyTaxable', () => {
    const h = holding({ price: 200, lots: [
      lot({ qty: 2, gasto: 100, buyDate: DATE_RECENT }),
    ]})
    const bd = holdingTaxBreakdown(h, NOW)
    expect(bd.isFullyTaxable).toBe(true)
    expect(bd.isFullyExempt).toBe(false)
    expect(bd.hasMixed).toBe(false)
    expect(bd.taxableValue).toBe(400)
    expect(bd.taxableGain).toBe(300)
    expect(bd.taxDue).toBeCloseTo(300 * 0.28, 6)
  })

  it('ganho negativo no tributável não produz imposto', () => {
    // Custo 800 (400€/un), preço actual 200€/un → perda clara
    const h = holding({ price: 200, lots: [
      lot({ qty: 2, gasto: 800, buyDate: DATE_RECENT }),
    ]})
    const bd = holdingTaxBreakdown(h, NOW)
    expect(bd.taxableGain).toBeLessThan(0)
    expect(bd.taxDue).toBe(0)
  })

  it('mix de isento e tributável: hasMixed=true, só o tributável paga', () => {
    const h = holding({ price: 100, lots: [
      lot({ qty: 1, gasto: 50,  buyDate: DATE_OVER_1Y }), // isento, ganho 50
      lot({ qty: 1, gasto: 40,  buyDate: DATE_RECENT }),  // tributável, ganho 60 → 28%
    ]})
    const bd = holdingTaxBreakdown(h, NOW)
    expect(bd.hasMixed).toBe(true)
    expect(bd.taxableGain).toBeCloseTo(60, 6)
    expect(bd.taxDue).toBeCloseTo(60 * 0.28, 6)
    expect(bd.exemptValue).toBe(100)
  })
})

// ── simulateSale — FIFO ─────────────────────────────────────────────
describe('simulateSale — FIFO (lote mais antigo primeiro)', () => {
  it('rejeita inputs inválidos', () => {
    const h = holding({ lots: [lot()] })
    expect(simulateSale(h, 0, 10, NOW)).toBeNull()
    expect(simulateSale(h, 1, 0, NOW)).toBeNull()
    expect(simulateSale(h, -1, 10, NOW)).toBeNull()
  })

  it('FIFO: consome o lote mais antigo antes do mais recente', () => {
    const h = holding({ lots: [
      { id: 'new', qty: 10, gasto: 200, buyDate: '2026-05-01' }, // 20€/un — recente
      { id: 'old', qty: 10, gasto: 100, buyDate: '2024-01-01' }, // 10€/un — ANTIGO, > 1 ano
    ]})
    // Vender 5 unidades a 30€ → consome do "old" primeiro (isento, gain 20×5=100), tax 0
    const sim = simulateSale(h, 5, 30, NOW)
    expect(sim.totalCost).toBeCloseTo(50, 6) // 5 × 10
    expect(sim.totalProceeds).toBeCloseTo(150, 6)
    expect(sim.exemptGain).toBeCloseTo(100, 6)
    expect(sim.taxableGain).toBe(0)
    expect(sim.taxDue).toBe(0)
  })

  it('FIFO: quando atravessa lots, cada porção aplica o seu regime fiscal', () => {
    const h = holding({ lots: [
      { id: 'old', qty: 3, gasto: 30,  buyDate: '2024-01-01' }, // 10€/un, isento
      { id: 'new', qty: 5, gasto: 100, buyDate: '2026-05-01' }, // 20€/un, tributável
    ]})
    // Vender 6 unidades a 30€:
    //   3 do "old" (isento): proceeds 90, custo 30, gain 60 → exempt
    //   3 do "new" (tributável): proceeds 90, custo 60, gain 30 → tax 30×0.28
    const sim = simulateSale(h, 6, 30, NOW)
    expect(sim.totalCost).toBeCloseTo(30 + 60, 6)
    expect(sim.exemptGain).toBeCloseTo(60, 6)
    expect(sim.taxableGain).toBeCloseTo(30, 6)
    expect(sim.taxDue).toBeCloseTo(30 * 0.28, 6)
  })

  it('FIFO: perda num lote tributável não reduz taxableGain (não se soma)', () => {
    // Regime PT: perdas em tributáveis não compensam ganhos neste cálculo
    const h = holding({ lots: [
      { id: 'a', qty: 2, gasto: 200, buyDate: DATE_RECENT }, // 100€/un — venda a 50€ é perda
    ]})
    const sim = simulateSale(h, 2, 50, NOW)
    expect(sim.totalGain).toBeCloseTo(-100, 6)
    expect(sim.taxableGain).toBe(0) // perda ignorada
    expect(sim.taxDue).toBe(0)
  })

  it('lots sem buyDate ficam no fim (tratados como mais recentes)', () => {
    const h = holding({ lots: [
      { id: 'no-date', qty: 3, gasto: 30 },
      { id: 'old',     qty: 2, gasto: 40, buyDate: '2024-01-01' }, // isento
    ]})
    // Vender 2 → consome o "old" (isento) primeiro
    const sim = simulateSale(h, 2, 50, NOW)
    expect(sim.totalCost).toBeCloseTo(40, 6)
    expect(sim.exemptGain).toBeCloseTo(100 - 40, 6)
  })
})

// ── executeSale — FIFO mutação ───────────────────────────────────────
describe('executeSale — FIFO com lots resultantes', () => {
  it('venda total consome todos os lots afectados', () => {
    const h = holding({ lots: [
      { id: 'a', qty: 2, gasto: 20, buyDate: '2026-01-01' },
      { id: 'b', qty: 3, gasto: 60, buyDate: '2026-02-01' },
    ]})
    const { newLots, realizedGain, realizedCost, realizedProceeds } = executeSale(h, 5, 20)
    expect(newLots).toHaveLength(0)
    expect(realizedProceeds).toBe(100)
    expect(realizedCost).toBeCloseTo(80, 6)
    expect(realizedGain).toBeCloseTo(20, 6)
  })

  it('venda parcial preserva lote remanescente com qty/gasto proporcionais', () => {
    const h = holding({ lots: [
      { id: 'a', qty: 10, gasto: 100, buyDate: '2026-01-01' }, // 10€/un
    ]})
    const { newLots, realizedGain, realizedCost } = executeSale(h, 4, 15)
    expect(newLots).toHaveLength(1)
    expect(newLots[0].qty).toBeCloseTo(6, 6)
    expect(newLots[0].gasto).toBeCloseTo(60, 6) // 100 - 40
    expect(realizedCost).toBeCloseTo(40, 6)
    expect(realizedGain).toBeCloseTo(4 * 15 - 40, 6)
  })

  it('lots posteriores ao consumido mantêm-se intactos', () => {
    const h = holding({ lots: [
      { id: 'a', qty: 2, gasto: 20, buyDate: '2026-01-01' },
      { id: 'b', qty: 5, gasto: 100, buyDate: '2026-02-01' },
    ]})
    const { newLots } = executeSale(h, 2, 20) // consome só o 'a'
    expect(newLots).toHaveLength(1)
    expect(newLots[0].id).toBe('b')
    expect(newLots[0].qty).toBe(5)
    expect(newLots[0].gasto).toBe(100)
  })

  it('não muta o holding original', () => {
    const h = holding({ lots: [
      { id: 'a', qty: 10, gasto: 100, buyDate: '2026-01-01' },
    ]})
    executeSale(h, 5, 20)
    expect(h.lots[0].qty).toBe(10)
    expect(h.lots[0].gasto).toBe(100)
  })
})

// ── lotMK / lotExistsAtMk (month-aware, regra dos dias) ─────────────
describe('lotMK / lotExistsAtMk', () => {
  it('lot sem buyDate → null (conta sempre)', () => {
    expect(lotMK({ id: 'x' })).toBeNull()
    expect(lotExistsAtMk({ id: 'x' }, getMK(2026, 5))).toBe(true)
  })

  it('comprado no dia 1 → conta nesse mês', () => {
    expect(lotMK({ buyDate: '2026-03-01' })).toBe(getMK(2026, 2))
    expect(lotExistsAtMk({ buyDate: '2026-03-01' }, getMK(2026, 2))).toBe(true)
    expect(lotExistsAtMk({ buyDate: '2026-03-01' }, getMK(2026, 1))).toBe(false)
  })

  it('comprado depois do dia 1 → só conta no mês seguinte', () => {
    expect(lotMK({ buyDate: '2026-03-15' })).toBe(getMK(2026, 3))
    expect(lotExistsAtMk({ buyDate: '2026-03-15' }, getMK(2026, 2))).toBe(false)
    expect(lotExistsAtMk({ buyDate: '2026-03-15' }, getMK(2026, 3))).toBe(true)
  })

  it('borda de ano: comprado dia > 1 em Dezembro → Jan do ano seguinte', () => {
    expect(lotMK({ buyDate: '2026-12-15' })).toBe(getMK(2027, 0))
  })
})

// ── holdingQtyAtMk / holdingGastoAtMk / holdingValueAtMk (crypto) ─
describe('totais crypto com mês', () => {
  it('só lots visíveis em mk contam', () => {
    const h = holding({ price: 100, lots: [
      { id: 'a', qty: 2, gasto: 50,  buyDate: '2026-01-01' }, // conta em Jan
      { id: 'b', qty: 3, gasto: 150, buyDate: '2026-03-15' }, // conta só em Abril
    ]})
    const MK_FEB = getMK(2026, 1)
    const MK_MAR = getMK(2026, 2)
    const MK_APR = getMK(2026, 3)

    expect(holdingQtyAtMk(h, MK_FEB)).toBe(2)
    expect(holdingGastoAtMk(h, MK_FEB)).toBe(50)
    expect(holdingValueAtMk(h, MK_FEB)).toBe(200)
    expect(holdingProfitAtMk(h, MK_FEB)).toBe(150)

    // Em Março ainda não conta o lote de '2026-03-15' (foi comprado dia 15)
    expect(holdingQtyAtMk(h, MK_MAR)).toBe(2)

    // Em Abril, ambos contam
    expect(holdingQtyAtMk(h, MK_APR)).toBe(5)
    expect(holdingGastoAtMk(h, MK_APR)).toBe(200)
  })

  it('holdingValueAtMk usa monthData[mk].price quando existe', () => {
    const MK = getMK(2026, 3)
    const h = holding({
      price: 100,
      lots: [{ qty: 2, gasto: 50, buyDate: '2026-01-01' }],
      monthData: { [MK]: { price: 250 } },
    })
    expect(holdingValueAtMk(h, MK)).toBe(2 * 250)
  })
})

describe('calcCryptoTotal', () => {
  it('devolve 0 para entradas inválidas', () => {
    expect(calcCryptoTotal(null)).toBe(0)
    expect(calcCryptoTotal(undefined)).toBe(0)
    expect(calcCryptoTotal({})).toBe(0)
  })

  it('suporta formato legacy {total}', () => {
    expect(calcCryptoTotal({ total: 1234.5 })).toBe(1234.5)
  })

  it('soma plataformas × holdings usando preço live quando mk é null', () => {
    const crypto = {
      platforms: [
        { holdings: [
          { price: 100, lots: [{ qty: 2, gasto: 50, buyDate: '2026-01-01' }] },
          { price:  50, lots: [{ qty: 4, gasto: 100, buyDate: '2026-01-01' }] },
        ]},
      ],
    }
    expect(calcCryptoTotal(crypto, null)).toBe(2 * 100 + 4 * 50)
  })

  it('usa preço histórico monthData[mk].price e filtra lotes por mês', () => {
    const MK = getMK(2026, 2) // Março
    const crypto = {
      platforms: [
        { holdings: [{
          price: 100,
          lots: [
            { qty: 1, gasto: 10, buyDate: '2026-01-01' }, // conta em Março
            { qty: 5, gasto: 50, buyDate: '2026-03-15' }, // só em Abril
          ],
          monthData: { [MK]: { price: 200 } },
        }]},
      ],
    }
    expect(calcCryptoTotal(crypto, MK)).toBe(1 * 200)
  })
})
