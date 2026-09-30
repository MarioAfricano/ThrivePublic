import { describe, it, expect } from 'vitest'
import {
  holdingQtyAtMk, holdingGastoAtMk, holdingActiveInMk, holdingEarliestBuyMk,
  calcHoldingValue, calcHoldingsTotal,
  calcDividendsYear, calcAllDividendsYear,
  calcBolsosTotal,
  getMK,
} from '../initialData.js'

const JAN = getMK(2026, 0)
const FEB = getMK(2026, 1)
const MAR = getMK(2026, 2)
const APR = getMK(2026, 3)
const MAY = getMK(2026, 4)

// ── holdingEarliestBuyMk ────────────────────────────────────────────
describe('holdingEarliestBuyMk', () => {
  it('sem lots devolve h.buyMk de raiz', () => {
    expect(holdingEarliestBuyMk({ buyMk: JAN })).toBe(JAN)
    expect(holdingEarliestBuyMk({})).toBe(null)
  })

  it('com lots devolve o mk mínimo', () => {
    const h = {
      buyMk: MAR,
      lots: [
        { id: 'a', qty: 1, gasto: 10, buyMk: FEB },
        { id: 'b', qty: 1, gasto: 10, buyMk: MAY },
      ],
    }
    expect(holdingEarliestBuyMk(h)).toBe(FEB)
  })
})

// ── holdingQtyAtMk / holdingGastoAtMk ───────────────────────────────
// Regra: compras contam SÓ a partir do mês seguinte (cur > buyMk),
//        vendas (isSell=true) contam no próprio mês (cur >= buyMk).
describe('holdingQtyAtMk — regra do "mês seguinte" para compras', () => {
  it('sem lots usa h.qty de raiz', () => {
    expect(holdingQtyAtMk({ qty: 3 }, APR)).toBe(3)
  })

  it('compra em Fev só conta a partir de Março', () => {
    const h = { lots: [{ id: 'a', qty: 10, gasto: 100, buyMk: FEB }] }
    expect(holdingQtyAtMk(h, FEB)).toBe(0) // no próprio mês de compra NÃO conta
    expect(holdingQtyAtMk(h, MAR)).toBe(10)
    expect(holdingQtyAtMk(h, APR)).toBe(10)
  })

  it('venda em Fev conta no próprio Fev', () => {
    const h = { lots: [
      { id: 'b', qty: 10,  gasto: 100, buyMk: JAN },            // compra antes → 10 em Feb
      { id: 's', qty: -4,  sellTotal: 60, isSell: true, buyMk: FEB },
    ]}
    // Em Fev a compra de Jan já conta (JAN < FEB), a venda de Fev também (<= FEB)
    expect(holdingQtyAtMk(h, FEB)).toBe(6)
  })

  it('sem mk soma todos os lots (compras + vendas)', () => {
    const h = { lots: [
      { id: 'a', qty: 10, gasto: 100, buyMk: JAN },
      { id: 's', qty: -4, sellTotal: 50, isSell: true, buyMk: FEB },
    ]}
    expect(holdingQtyAtMk(h, null)).toBe(6)
  })
})

describe('holdingGastoAtMk — só compras, regra do mês seguinte', () => {
  it('sell lots NÃO afectam o gasto', () => {
    const h = { lots: [
      { id: 'a', qty: 10, gasto: 200, buyMk: JAN },
      { id: 's', qty: -5, sellTotal: 80, isSell: true, buyMk: FEB },
    ]}
    expect(holdingGastoAtMk(h, MAR)).toBe(200)
  })

  it('compra no próprio mês pedido ainda não conta', () => {
    const h = { lots: [
      { id: 'a', qty: 5, gasto: 50, buyMk: FEB },
    ]}
    expect(holdingGastoAtMk(h, FEB)).toBe(0)
    expect(holdingGastoAtMk(h, MAR)).toBe(50)
  })
})

// ── holdingActiveInMk ───────────────────────────────────────────────
describe('holdingActiveInMk', () => {
  it('sem mk: activo se não tem sellMk nem foi vendido a zero via sell lots', () => {
    expect(holdingActiveInMk({})).toBe(true)
    expect(holdingActiveInMk({ sellMk: MAR })).toBe(false)
    const h = { lots: [
      { id: 'a', qty: 10, gasto: 100, buyMk: JAN },
      { id: 's', qty: -10, sellTotal: 150, isSell: true, buyMk: FEB },
    ]}
    expect(holdingActiveInMk(h, null)).toBe(false) // vendido até zero
  })

  it('comprado em mês futuro → inactivo', () => {
    const h = { lots: [{ id: 'a', qty: 5, gasto: 50, buyMk: APR }] }
    expect(holdingActiveInMk(h, FEB)).toBe(false)
    expect(holdingActiveInMk(h, APR)).toBe(false) // no próprio mês ainda não "activo"
    expect(holdingActiveInMk(h, MAY)).toBe(true)
  })

  it('venda total antes de mk → inactivo', () => {
    const h = { buyMk: JAN, sellMk: MAR }
    expect(holdingActiveInMk(h, FEB)).toBe(true)
    expect(holdingActiveInMk(h, MAR)).toBe(true) // sellMk < cur é a condição, MAR == MAR não é <
    expect(holdingActiveInMk(h, APR)).toBe(false)
  })

  it('venda parcial: activo enquanto qty restante > 0', () => {
    const h = { lots: [
      { id: 'a', qty: 10, gasto: 100, buyMk: JAN },
      { id: 's', qty: -10, sellTotal: 150, isSell: true, buyMk: MAR },
    ]}
    expect(holdingActiveInMk(h, FEB)).toBe(true) // venda ainda não aconteceu
    // Em MAR, a venda conta (<=), qty restante = 0 → inactivo
    expect(holdingActiveInMk(h, MAR)).toBe(false)
  })
})

// ── calcHoldingValue / calcHoldingsTotal ────────────────────────────
describe('calcHoldingValue / calcHoldingsTotal', () => {
  it('calcHoldingValue: qty × price actual quando não há monthData', () => {
    const h = { price: 20, lots: [{ id: 'a', qty: 5, gasto: 50, buyMk: JAN }] }
    expect(calcHoldingValue(h, MAR)).toBe(5 * 20)
  })

  it('calcHoldingValue: usa monthData[mk].price quando existe', () => {
    const h = {
      price: 20,
      lots: [{ id: 'a', qty: 5, gasto: 50, buyMk: JAN }],
      monthData: { [MAR]: { price: 50 } },
    }
    expect(calcHoldingValue(h, MAR)).toBe(5 * 50)
  })

  it('calcHoldingValue: holding inactivo devolve 0', () => {
    const h = { price: 20, lots: [{ id: 'a', qty: 5, gasto: 50, buyMk: MAY }] } // futuro
    expect(calcHoldingValue(h, MAR)).toBe(0)
  })

  it('calcHoldingsTotal soma valores de todos os holdings', () => {
    const holdings = [
      { price: 10, lots: [{ qty: 2, gasto: 15, buyMk: JAN }] },
      { price: 25, lots: [{ qty: 4, gasto: 80, buyMk: JAN }] },
    ]
    expect(calcHoldingsTotal(holdings, MAR)).toBe(20 + 100)
  })
})

// ── Dividendos ──────────────────────────────────────────────────────
describe('calcDividendsYear / calcAllDividendsYear', () => {
  it('filtra por ano usando mk ou date', () => {
    const h = { dividends: [
      { id: 'd1', mk: getMK(2026, 4), amount: 50 },
      { id: 'd2', date: '2026-11-05', amount: 80 },
      { id: 'd3', date: '2025-03-10', amount: 999 }, // ano anterior
    ]}
    expect(calcDividendsYear(h, 2026)).toBe(130)
    expect(calcDividendsYear(h, 2025)).toBe(999)
  })

  it('ignora dividendos sem mk e sem date', () => {
    const h = { dividends: [{ id: 'd', amount: 100 }] }
    expect(calcDividendsYear(h, 2026)).toBe(0)
  })

  it('calcAllDividendsYear soma em múltiplos holdings', () => {
    const hs = [
      { dividends: [{ mk: getMK(2026, 0), amount: 10 }] },
      { dividends: [{ mk: getMK(2026, 5), amount: 25 }] },
    ]
    expect(calcAllDividendsYear(hs, 2026)).toBe(35)
  })
})

// ── calcBolsosTotal ─────────────────────────────────────────────────
describe('calcBolsosTotal', () => {
  it('soma valorAtual de raiz quando não há monthData', () => {
    const bolsos = [{ valorAtual: 100 }, { valorAtual: 250 }]
    expect(calcBolsosTotal(bolsos, MAR)).toBe(350)
  })

  it('usa monthData[mk].valorAtual quando existe', () => {
    const bolsos = [
      { valorAtual: 100, monthData: { [MAR]: { valorAtual: 400 } } },
      { valorAtual: 50 },
    ]
    expect(calcBolsosTotal(bolsos, MAR)).toBe(400 + 50)
  })
})
