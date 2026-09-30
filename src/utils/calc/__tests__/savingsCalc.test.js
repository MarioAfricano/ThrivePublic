import { describe, it, expect } from 'vitest'
import {
  AFORRO_TIERS, AFORRO_IRS_RATE, getAforroTier,
  aforroMonthsAt,
  calcAforroValueFromMonths, calcAforroValueAt, calcAforroTotal,
  aforroAddMonths, aforroNextPaymentDate, aforroEstimateNextPayment,
  AFORRO_EURIBOR_CAP, capAforroBaseRate, aforroEffectiveRate,
} from '../savingsCalc.js'

// ── Fixtures ────────────────────────────────────────────────────────
// "Agora" fixa para testes de data: 2026-06-15 00:00 local.
const NOW = new Date(2026, 5, 15).getTime()

function cert(overrides = {}) {
  return { id: 'c1', amount: 10000, date: '2025-01-01', ...overrides }
}

// ── Tiers ───────────────────────────────────────────────────────────
describe('AFORRO_TIERS / getAforroTier', () => {
  it('tem exactamente 4 escalões', () => {
    expect(AFORRO_TIERS).toHaveLength(4)
  })

  it('bónus corresponde ao regime (0, 0.25%, 0.5%, 1%)', () => {
    expect(AFORRO_TIERS.map(t => t.bonus)).toEqual([0, 0.0025, 0.005, 0.01])
  })

  it('getAforroTier respeita bordas exactas', () => {
    expect(getAforroTier(0).bonus).toBe(0)         // Ano 1
    expect(getAforroTier(11).bonus).toBe(0)
    expect(getAforroTier(12).bonus).toBe(0.0025)   // Ano 2 começa em 12
    expect(getAforroTier(23).bonus).toBe(0.0025)
    expect(getAforroTier(24).bonus).toBe(0.005)    // Ano 3
    expect(getAforroTier(35).bonus).toBe(0.005)
    expect(getAforroTier(36).bonus).toBe(0.01)     // Ano 4+
    expect(getAforroTier(999).bonus).toBe(0.01)
  })
})

describe('AFORRO_IRS_RATE', () => {
  it('é 28%', () => { expect(AFORRO_IRS_RATE).toBe(0.28) })
})

// ── aforroMonthsAt ──────────────────────────────────────────────────
describe('aforroMonthsAt', () => {
  it('0 para data vazia', () => {
    expect(aforroMonthsAt(null, null, NOW)).toBe(0)
    expect(aforroMonthsAt('', null, NOW)).toBe(0)
  })

  it('meses entre data de subscrição e agora', () => {
    // 2025-01-01 → 2026-06-15 → ~530 dias / 30.4375 ≈ 17 meses
    expect(aforroMonthsAt('2025-01-01', null, NOW)).toBe(17)
  })

  it('meses entre data e início de monthKey', () => {
    // 2025-01-01 → 2026-06-01 = 516 dias / 30.4375 ≈ 16 (Math.floor)
    expect(aforroMonthsAt('2025-01-01', '2026-5')).toBe(16)
  })

  it('nunca negativo', () => {
    expect(aforroMonthsAt('2030-01-01', null, NOW)).toBe(0)
  })
})

// ── calcAforroValueFromMonths — juros + IRS ─────────────────────────
describe('calcAforroValueFromMonths — motor de juros trimestral', () => {
  it('0 meses → devolve só o capital (sem juros)', () => {
    const c = cert({ amount: 5000 })
    expect(calcAforroValueFromMonths(c, 0.02, 0)).toBe(5000)
  })

  it('meses parciais de trimestre são ignorados', () => {
    // 2 meses decorridos: só 0 trimestres completos → 0 juros
    const c = cert({ amount: 1000 })
    expect(calcAforroValueFromMonths(c, 0.04, 2)).toBe(1000)
  })

  it('3 meses, 0.02 euribor, sem rateHistory, ano 1 (sem bónus): juros trim + IRS', () => {
    // Taxa abaixo do tecto de 2,50%, para isolar o motor de juros do cap.
    // mês 0, 1, 2: rate 0.02, bonus 0. Juro mensal bruto: 10000 × 0.02 / 12 = 16.66...
    // round 2 casas a cada iteração:
    //   m=0: 16.67
    //   m=1: 16.67 + 16.67 = 33.34
    //   m=2: 33.34 + 16.67 = 50.01
    // líquido: 50.01 × 0.72 = 36.0072
    // total = 10000 + 36.01 = 10036.01
    const c = cert({ amount: 10000 })
    const v = calcAforroValueFromMonths(c, 0.02, 3)
    expect(v).toBeCloseTo(10036.01, 2)
  })

  it('valueOverride sobrepõe-se a tudo', () => {
    const c = cert({ valueOverride: 12345.67 })
    expect(calcAforroValueFromMonths(c, 0.04, 36)).toBe(12345.67)
  })

  it('rateHistory[ps] sobrepõe-se ao euribor para esse período trimestral', () => {
    // Ambas as taxas abaixo do tecto, senão o cap igualava-as e o teste
    // deixava de provar que o rateHistory se sobrepõe.
    // 3 meses, rateHistory[0] = 0.024, euribor = 0.005 → deve usar 0.024
    const c = cert({ amount: 1000, rateHistory: { 0: 0.024 } })
    // 3 meses simples: 1000 × 0.024 / 12 × 3 = 6 (bruto). Líquido × 0.72 = 4.32
    const v = calcAforroValueFromMonths(c, 0.005, 3)
    expect(v).toBeCloseTo(1000 + 6 * (1 - 0.28), 1)
  })

  it('bónus muda no mês 12 (começo do ano 2, +0.25%)', () => {
    // Para 12 meses com rate 0 e bónus:
    //   m=0..11 → bonus 0 (ano 1)
    // juro: 0 em todos → total 10000
    // Agora para 15 meses: m=0..11 → bonus 0, m=12,13,14 → bonus 0.0025
    //   3 trimestres completos → 12 meses + 3 = 15 (todos contam)
    //   juro m=12: 10000 × (0 + 0.0025) / 12 = 2.083 (→ 2.08 round)
    //   juro m=13: 2.08 + 2.083 = 4.163 → 4.16
    //   juro m=14: 4.16 + 2.083 = 6.243 → 6.24
    //   juros totais brutos ≈ 6.24, líquidos × 0.72 ≈ 4.49
    const c = cert({ amount: 10000 })
    const v = calcAforroValueFromMonths(c, 0, 15) // euribor = 0, só o bónus conta
    expect(v).toBeCloseTo(10000 + 6.24 * (1 - 0.28), 1)
  })

  it('nº de trimestres truncado: 4 meses ainda é 1 trimestre (3 meses)', () => {
    const c = cert({ amount: 10000 })
    const v3 = calcAforroValueFromMonths(c, 0.04, 3)
    const v4 = calcAforroValueFromMonths(c, 0.04, 4)
    expect(v4).toBe(v3) // 4 meses arredondam para 3 (1 trimestre)
  })

  it('IRS aplica-se só aos juros, não ao capital', () => {
    // Sem juros, o valor é exactamente o capital, sem IRS
    const c = cert({ amount: 7500 })
    expect(calcAforroValueFromMonths(c, 0, 3)).toBe(7500) // rate=0 → 0 juros → sem IRS
  })
})

// ── calcAforroValueAt ───────────────────────────────────────────────
describe('calcAforroValueAt', () => {
  it('usa aforroMonthsAt + calcAforroValueFromMonths', () => {
    const c = cert({ amount: 10000, date: '2025-01-01' })
    // Até MK_JUN_2026 → 16 meses (ver aforroMonthsAt). 16/3=5 trimestres = 15 meses.
    // Motor de juros vai correr 15 iterações. O valor exacto não é trivial mas testamos a consistência.
    const v = calcAforroValueAt(c, 0.04, '2026-5', NOW)
    const months = aforroMonthsAt(c.date, '2026-5', NOW)
    const direct = calcAforroValueFromMonths(c, 0.04, months)
    expect(v).toBe(direct)
  })

  it('valueOverride sobrepõe-se', () => {
    expect(calcAforroValueAt(cert({ valueOverride: 9999 }), 0.04, '2026-5', NOW)).toBe(9999)
  })
})

// ── calcAforroTotal ─────────────────────────────────────────────────
describe('calcAforroTotal', () => {
  it('exclui certificados subscritos no próprio mês pedido', () => {
    const aforro = {
      euribor: 0.02,
      certificates: [
        cert({ id: 'old', amount: 1000, date: '2025-01-01' }), // conta
        cert({ id: 'new', amount: 5000, date: '2026-06-10' }), // subscrito em Jun 2026, não conta em MK_JUN
      ],
    }
    const total = calcAforroTotal(aforro, '2026-5', NOW)
    // Só o "old" entra → 1000 capital + ~16 meses de juros a 0.02 líquidos de IRS
    // (5 trimestres completos, bónus Ano 1/Ano 2) ≈ 1018.49
    expect(total).toBeLessThan(1030)
    expect(total).toBeGreaterThan(1000)
  })

  it('sem monthKey soma todos os certificados (com juros live)', () => {
    const aforro = {
      euribor: 0,
      certificates: [
        cert({ amount: 500, date: '2020-01-01' }), // bem antigo, muitos trimestres
      ],
    }
    expect(calcAforroTotal(aforro, null, NOW)).toBeGreaterThanOrEqual(500)
  })

  it('lista vazia devolve 0', () => {
    expect(calcAforroTotal({ certificates: [] }, '2026-5')).toBe(0)
    expect(calcAforroTotal(null, '2026-5')).toBe(0)
  })
})

// ── aforroAddMonths ─────────────────────────────────────────────────
describe('aforroAddMonths', () => {
  it('adiciona meses preservando o dia', () => {
    const d = aforroAddMonths('2026-01-15', 3)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(3) // Abril (0-indexed)
    expect(d.getDate()).toBe(15)
  })

  it('dia 31 + 1 mês ajusta para o último dia do mês alvo (comportamento JS nativo)', () => {
    // Jan 31 + 1 = Fev → Fev não tem 31, JS avança para Mar 3 (2026 não bissexto)
    const d = aforroAddMonths('2026-01-31', 1)
    expect(d.getMonth()).toBe(2) // Março
    expect(d.getDate()).toBe(3)  // 28 Fev + 3 = 3 Mar (ou 29+2 em bissexto)
  })
})

// ── aforroEstimateNextPayment ──────────────────────────────────────
describe('aforroEstimateNextPayment', () => {
  it('usa taxa do período actual + bónus do tier vigente, líquido de IRS', () => {
    // Subscrito há ~13 meses → tier ano 2 (bónus 0.0025)
    // ps = Math.floor(13/3)*3 = 12. rateHistory[12] não existe → usa euribor
    const c = cert({ amount: 1000, date: '2025-05-01' })
    const est = aforroEstimateNextPayment(c, 0.02, NOW)
    // (0.02 + 0.0025) / 4 × 1000 × 0.72 ≈ 4.05
    expect(est).toBeCloseTo(1000 * (0.02 + 0.0025) / 4 * 0.72, 4)
  })

  it('usa rateHistory[ps] quando disponível', () => {
    const c = cert({ amount: 1000, date: '2025-05-01', rateHistory: { 12: 0.024 } })
    const est = aforroEstimateNextPayment(c, 0.01, NOW) // ps=12 → 0.024
    expect(est).toBeCloseTo(1000 * (0.024 + 0.0025) / 4 * 0.72, 4)
  })
})

// ── aforroNextPaymentDate ───────────────────────────────────────────
describe('aforroNextPaymentDate', () => {
  it('próximo trimestre após a última data de pagamento', () => {
    // Subscrito 2025-01-01, agora 2026-06-15 → 17.4 meses → 5 trimestres completos (15 meses).
    // Próximo pagamento deve ser 2025-01-01 + 6 trim = 2026-07-01.
    const next = aforroNextPaymentDate('2025-01-01', NOW)
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(6) // Julho 0-indexed
  })

  it('se o próximo calculado já passou, avança mais 1 trimestre', () => {
    // start 2026-01-01, now = exactamente +3 meses (2026-04-01): o próximo trimestre
    // natural coincide com now → fallback aplica +1 trimestre → Julho (mês 6).
    const now = new Date(2026, 3, 1).getTime()
    const next = aforroNextPaymentDate('2026-01-01', now)
    expect(next.getMonth()).toBe(6) // Julho
  })
})

// ── Tecto da Euribor (Série F) ──────────────────────────────────────
// A componente Euribor está limitada a 2,50%. O bónus de permanência
// acumula POR CIMA do tecto, logo a taxa efectiva pode passar de 2,50%.
describe('tecto Euribor da Série F', () => {
  it('o tecto é 2,50%', () => {
    expect(AFORRO_EURIBOR_CAP).toBe(0.025)
  })

  it('capAforroBaseRate não mexe em taxas abaixo do tecto', () => {
    expect(capAforroBaseRate(0.02)).toBe(0.02)
    expect(capAforroBaseRate(0.025)).toBe(0.025)
    expect(capAforroBaseRate(0)).toBe(0)
  })

  it('capAforroBaseRate corta acima do tecto', () => {
    expect(capAforroBaseRate(0.03)).toBe(0.025)
    expect(capAforroBaseRate(0.05)).toBe(0.025)
  })

  it('trata null/undefined como 0', () => {
    expect(capAforroBaseRate(null)).toBe(0)
    expect(capAforroBaseRate(undefined)).toBe(0)
  })

  it('o bónus acumula por cima do tecto (Ano 4+ chega a 3,50%)', () => {
    expect(aforroEffectiveRate(0.04, 0.01)).toBeCloseTo(0.035, 10)
    expect(aforroEffectiveRate(0.02, 0.01)).toBeCloseTo(0.03, 10)
  })

  it('Euribor a 4% rende o mesmo que a 2,5% (tecto activo)', () => {
    const c = cert()
    expect(calcAforroValueFromMonths(c, 0.04, 12))
      .toBe(calcAforroValueFromMonths(c, 0.025, 12))
  })

  it('abaixo do tecto a Euribor ainda faz diferença', () => {
    const c = cert()
    expect(calcAforroValueFromMonths(c, 0.02, 12))
      .toBeLessThan(calcAforroValueFromMonths(c, 0.025, 12))
  })

  it('rateHistory guardado acima do tecto também é limitado', () => {
    const acima = cert({ rateHistory: { 0: 0.06, 3: 0.06, 6: 0.06, 9: 0.06 } })
    const notec = cert({ rateHistory: { 0: 0.025, 3: 0.025, 6: 0.025, 9: 0.025 } })
    expect(calcAforroValueFromMonths(acima, 0, 12))
      .toBe(calcAforroValueFromMonths(notec, 0, 12))
  })

  it('aforroEstimateNextPayment respeita o tecto', () => {
    const c = cert({ date: '2025-01-01' })
    expect(aforroEstimateNextPayment(c, 0.04, NOW))
      .toBeCloseTo(aforroEstimateNextPayment(c, 0.025, NOW), 10)
  })

  it('valueOverride continua a ignorar o cálculo todo', () => {
    expect(calcAforroValueFromMonths(cert({ valueOverride: 12345 }), 0.09, 24)).toBe(12345)
  })
})
