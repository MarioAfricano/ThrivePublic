import { describe, it, expect } from 'vitest'
import {
  getMonthPayments, getAllPayments, getDebtPayoff, buildYearlyChart,
} from '../debtCalc.js'
import { getMK } from '../../dateUtils.js'

const JAN = getMK(2026, 0)
const FEB = getMK(2026, 1)
const MAR = getMK(2026, 2)
const APR = getMK(2026, 3)
const MAY = getMK(2026, 4)

// ── getMonthPayments ────────────────────────────────────────────────
describe('getMonthPayments', () => {
  it('sem pagamentos devolve []', () => {
    expect(getMonthPayments({}, JAN)).toEqual([])
    expect(getMonthPayments({ pagamentos: {} }, JAN)).toEqual([])
  })

  it('formato array (actual) devolve directo', () => {
    const debt = { pagamentos: { [JAN]: [
      { id: 'p1', valor: 200, saldoRestante: 9800 },
      { id: 'p2', valor: 100, saldoRestante: 9700 },
    ]}}
    expect(getMonthPayments(debt, JAN)).toHaveLength(2)
    expect(getMonthPayments(debt, JAN)[1].valor).toBe(100)
  })

  it('formato legacy { pago: true } converte-se para 1 entrada com id "legacy"', () => {
    const debt = { pagamentos: { [JAN]: { pago: true, valor: 250, saldoRestante: 9750 } } }
    const res = getMonthPayments(debt, JAN)
    expect(res).toHaveLength(1)
    expect(res[0]).toEqual({ id: 'legacy', valor: 250, saldoRestante: 9750 })
  })

  it('legacy { pago: false } devolve []', () => {
    const debt = { pagamentos: { [JAN]: { pago: false, valor: 0 } } }
    expect(getMonthPayments(debt, JAN)).toEqual([])
  })
})

// ── getAllPayments ──────────────────────────────────────────────────
describe('getAllPayments', () => {
  it('ordenado ascendentemente e ignora meses > currentMK', () => {
    const debt = { pagamentos: {
      [MAR]: [{ id: 'c', valor: 300, saldoRestante: 7000 }],
      [JAN]: [{ id: 'a', valor: 100, saldoRestante: 9000 }],
      [FEB]: [{ id: 'b', valor: 200, saldoRestante: 8800 }],
      [MAY]: [{ id: 'futuro', valor: 500, saldoRestante: 100 }],
    }}
    const res = getAllPayments(debt, APR)
    expect(res.map(p => p.id)).toEqual(['a', 'b', 'c'])
    expect(res.every(p => p.mk !== MAY)).toBe(true)
  })

  it('múltiplos pagamentos no mesmo mês são todos incluídos', () => {
    const debt = { pagamentos: { [FEB]: [
      { id: 'x', valor: 100, saldoRestante: 9900 },
      { id: 'y', valor: 200, saldoRestante: 9700 },
    ]}}
    expect(getAllPayments(debt, FEB)).toHaveLength(2)
  })
})

// ── getDebtPayoff — saldo ───────────────────────────────────────────
describe('getDebtPayoff — currentBalance', () => {
  it('sem pagamentos usa montanteInicial', () => {
    const debt = { montanteInicial: 10000, prestacaoMensal: 500 }
    const res = getDebtPayoff(debt, APR)
    expect(res.currentBalance).toBe(10000)
  })

  it('com pagamentos usa o saldoRestante do último pagamento', () => {
    const debt = {
      montanteInicial: 10000, prestacaoMensal: 500,
      pagamentos: {
        [JAN]: [{ id: 'p1', valor: 500, saldoRestante: 9500 }],
        [FEB]: [{ id: 'p2', valor: 500, saldoRestante: 9000 }],
      },
    }
    expect(getDebtPayoff(debt, APR).currentBalance).toBe(9000)
  })

  it('ignora pagamentos futuros ao calcular balance', () => {
    const debt = {
      montanteInicial: 10000, prestacaoMensal: 500,
      pagamentos: {
        [FEB]: [{ id: 'p', valor: 500, saldoRestante: 9500 }],
        [MAY]: [{ id: 'future', valor: 500, saldoRestante: 5000 }],
      },
    }
    expect(getDebtPayoff(debt, MAR).currentBalance).toBe(9500)
  })
})

// ── getDebtPayoff — monthlyRate ─────────────────────────────────────
describe('getDebtPayoff — monthlyRate', () => {
  it('sem pagamentos cai em prestacaoMensal', () => {
    const res = getDebtPayoff({ montanteInicial: 10000, prestacaoMensal: 250 }, APR)
    expect(res.monthlyRate).toBe(250)
  })

  it('múltiplos pagamentos no mesmo mês somam antes da média', () => {
    const debt = {
      montanteInicial: 10000, prestacaoMensal: 500,
      pagamentos: {
        [JAN]: [
          { id: 'a', valor: 300, saldoRestante: 9700 },
          { id: 'b', valor: 200, saldoRestante: 9500 }, // total Jan = 500
        ],
        [FEB]: [{ id: 'c', valor: 500, saldoRestante: 9000 }],
      },
    }
    // 2 meses, total pago por mês [500, 500] → avg 500
    expect(getDebtPayoff(debt, APR).monthlyRate).toBe(500)
  })

  it('média ignora meses sem pagamentos', () => {
    // 2 meses com pagamentos (Jan=500, Mar=300), Fev sem → média = 400
    const debt = {
      montanteInicial: 10000, prestacaoMensal: 999,
      pagamentos: {
        [JAN]: [{ valor: 500, saldoRestante: 9500 }],
        [MAR]: [{ valor: 300, saldoRestante: 9200 }],
      },
    }
    expect(getDebtPayoff(debt, APR).monthlyRate).toBe(400)
  })
})

// ── getDebtPayoff — payoff date ─────────────────────────────────────
describe('getDebtPayoff — data de fim', () => {
  it('monthsLeft = ceil(balance / rate)', () => {
    const debt = { montanteInicial: 1000, prestacaoMensal: 300 }
    const res = getDebtPayoff(debt, JAN) // balance 1000, rate 300 → 4 meses
    expect(res.monthsLeft).toBe(4)
    // JAN (2026-0) + 4 = MAI (2026-4)
    expect(res.payoffYear).toBe(2026)
    expect(res.payoffMonth).toBe(4)
  })

  it('propaga para ano seguinte', () => {
    const debt = { montanteInicial: 10000, prestacaoMensal: 1000 }
    // Dez 2026 + 10 meses = Out 2027
    const res = getDebtPayoff(debt, getMK(2026, 11))
    expect(res.monthsLeft).toBe(10)
    expect(res.payoffYear).toBe(2027)
    expect(res.payoffMonth).toBe(9) // 0-indexed: Outubro
  })

  it('rate = 0 → monthsLeft/payoff null', () => {
    const debt = { montanteInicial: 1000, prestacaoMensal: 0 }
    const res = getDebtPayoff(debt, JAN)
    expect(res.monthsLeft).toBeNull()
    expect(res.payoffYear).toBeNull()
    expect(res.payoffMonth).toBeNull()
  })

  it('saldo igual a zero: monthsLeft = 0', () => {
    const debt = {
      montanteInicial: 1000, prestacaoMensal: 100,
      pagamentos: { [JAN]: [{ valor: 1000, saldoRestante: 0 }] },
    }
    const res = getDebtPayoff(debt, FEB)
    expect(res.currentBalance).toBe(0)
    expect(res.monthsLeft).toBe(0)
  })
})

// ── buildYearlyChart ────────────────────────────────────────────────
describe('buildYearlyChart', () => {
  it('sem pagamentos o 1º ano tem actual = montanteInicial', () => {
    const debt = { montanteInicial: 1000, prestacaoMensal: 250 }
    const pts = buildYearlyChart(debt, JAN)
    expect(pts[0].year).toBe(2026)
    expect(pts[0].actual).toBe(1000)
  })

  it('pagamentos em anos distintos dão actual para cada ano', () => {
    const debt = {
      montanteInicial: 5000, prestacaoMensal: 500, inicioMK: getMK(2025, 0),
      pagamentos: {
        [getMK(2025, 5)]:  [{ valor: 500, saldoRestante: 4500 }],
        [getMK(2026, 0)]:  [{ valor: 500, saldoRestante: 4000 }],
      },
    }
    const pts = buildYearlyChart(debt, JAN)
    const y2025 = pts.find(p => p.year === 2025)
    const y2026 = pts.find(p => p.year === 2026)
    expect(y2025?.actual).toBe(4500)
    expect(y2026?.actual).toBe(4000)
  })

  it('projected converge para 0 e o gráfico termina quando o balance chega a 0', () => {
    const debt = { montanteInicial: 1200, prestacaoMensal: 100 }
    const pts = buildYearlyChart(debt, JAN)
    const last = pts[pts.length - 1]
    expect(last.projected).toBe(0)
  })

  it('actual do primeiro ano SEM pagamentos é o montanteInicial', () => {
    const debt = { montanteInicial: 8000, prestacaoMensal: 200, inicioMK: getMK(2024, 0) }
    const pts = buildYearlyChart(debt, JAN)
    expect(pts[0].year).toBe(2024)
    expect(pts[0].actual).toBe(8000)
  })

  it('startYear usa inicioMK quando definido', () => {
    const debt = { montanteInicial: 1000, prestacaoMensal: 100, inicioMK: getMK(2023, 5) }
    const pts = buildYearlyChart(debt, JAN)
    expect(pts[0].year).toBe(2023)
  })
})
