import { describe, it, expect } from 'vitest'
import { goalCurrent, goalProgress, monthsUntilMK, requiredMonthlyContribution, goalActualPace, goalContributionPace, monthsToReach, GOAL_CATEGORY_LABELS } from '../goalCalc.js'

const SNAP = { banco: 1000, poupanca: 5000, aforro: 2000, acoes: 3000, etfs: 4000, ppr: 1500, crypto: 500 }
const NOW = new Date(2026, 6, 15) // 15 jul 2026

describe('goalCurrent', () => {
  it('soma só as categorias escolhidas', () => {
    expect(goalCurrent({ categorias: ['poupanca', 'aforro'] }, SNAP)).toBe(7000)
  })
  it('sem categorias = todo o património', () => {
    expect(goalCurrent({}, SNAP)).toBe(17000)
    expect(goalCurrent({ categorias: [] }, SNAP)).toBe(17000)
  })
  it('robusto a snapshot vazio e categorias desconhecidas', () => {
    expect(goalCurrent({ categorias: ['poupanca'] }, null)).toBe(0)
    expect(goalCurrent({ categorias: ['inexistente'] }, SNAP)).toBe(0)
  })
})

describe('monthsUntilMK', () => {
  it('conta meses até ao fim do mês do prazo, incluindo o corrente', () => {
    expect(monthsUntilMK('2026-6', NOW)).toBe(1)  // prazo este mês
    expect(monthsUntilMK('2026-11', NOW)).toBe(6) // até dez 2026
    expect(monthsUntilMK('2028-6', NOW)).toBe(25)
  })
  it('prazo no passado → 0', () => {
    expect(monthsUntilMK('2026-5', NOW)).toBe(0)
    expect(monthsUntilMK('2025-11', NOW)).toBe(0)
  })
  it('inválido → null', () => {
    expect(monthsUntilMK(null, NOW)).toBeNull()
    expect(monthsUntilMK('abc', NOW)).toBeNull()
  })
})

describe('goalProgress', () => {
  it('progresso, falta e ritmo necessário', () => {
    const p = goalProgress({ alvo: 20000, deadlineMK: '2027-5', categorias: ['poupanca', 'aforro'] }, SNAP, NOW)
    expect(p.atual).toBe(7000)
    expect(p.pct).toBe(35)
    expect(p.falta).toBe(13000)
    expect(p.atingido).toBe(false)
    expect(p.mesesRestantes).toBe(12) // jul 2026 → jun 2027
    expect(p.ritmoNecessario).toBeCloseTo(13000 / 12, 5)
    expect(p.expirado).toBe(false)
  })

  it('meta atingida: pct limitado a 100 e sem ritmo', () => {
    const p = goalProgress({ alvo: 5000, deadlineMK: '2027-0', categorias: ['poupanca', 'aforro'] }, SNAP, NOW)
    expect(p.atingido).toBe(true)
    expect(p.pct).toBe(100)
    expect(p.falta).toBe(0)
    expect(p.ritmoNecessario).toBeNull()
  })

  it('prazo expirado sem atingir', () => {
    const p = goalProgress({ alvo: 20000, deadlineMK: '2026-0', categorias: ['poupanca'] }, SNAP, NOW)
    expect(p.expirado).toBe(true)
    expect(p.ritmoNecessario).toBeNull()
  })

  it('sem prazo: sem meses nem ritmo', () => {
    const p = goalProgress({ alvo: 20000, categorias: ['poupanca'] }, SNAP, NOW)
    expect(p.mesesRestantes).toBeNull()
    expect(p.ritmoNecessario).toBeNull()
    expect(p.expirado).toBe(false)
  })

  it('alvo 0 não divide por zero', () => {
    const p = goalProgress({ alvo: 0 }, SNAP, NOW)
    expect(p.pct).toBe(0)
    expect(p.atingido).toBe(false)
  })
})

describe('requiredMonthlyContribution', () => {
  it('sem retorno degrada para o linear', () => {
    expect(requiredMonthlyContribution(10000, 20000, 12, 0)).toBeCloseTo(10000 / 12, 6)
    expect(requiredMonthlyContribution(10000, 20000, 12)).toBeCloseTo(10000 / 12, 6)
  })

  it('com retorno composto: fórmula da anuidade', () => {
    // Retorno anual que dá exatamente 1%/mês: (1.01)^12 − 1
    const anual = Math.pow(1.01, 12) - 1
    // FV do atual: 10000·1.01^12 = 11268.25; PMT = (20000−11268.25)·0.01/(1.01^12−1)
    const pmt = requiredMonthlyContribution(10000, 20000, 12, anual)
    const esperado = ((20000 - 10000 * Math.pow(1.01, 12)) * 0.01) / (Math.pow(1.01, 12) - 1)
    expect(pmt).toBeCloseTo(esperado, 6)
    expect(pmt).toBeLessThan(10000 / 12) // o mercado ajuda → precisa de menos
  })

  it('0 quando o crescimento sozinho chega ao alvo', () => {
    // 10000 a 7%/ano durante 10 anos ≈ 19672 → alvo 15000 já está garantido
    expect(requiredMonthlyContribution(10000, 15000, 120, 0.07)).toBe(0)
  })

  it('null sem meses', () => {
    expect(requiredMonthlyContribution(10000, 20000, 0, 0.07)).toBeNull()
    expect(requiredMonthlyContribution(10000, 20000, null, 0.07)).toBeNull()
  })
})

describe('goalProgress com retornoAnual', () => {
  it('usa o composto no ritmo e mantém o resto igual', () => {
    const goal = { alvo: 20000, deadlineMK: '2027-5', categorias: ['etfs'], retornoAnual: 0.07 }
    const p = goalProgress(goal, SNAP, NOW) // etfs = 4000, 12 meses
    expect(p.mesesRestantes).toBe(12)
    expect(p.ritmoNecessario).toBeCloseTo(
      requiredMonthlyContribution(4000, 20000, 12, 0.07), 6)
    expect(p.ritmoNecessario).toBeLessThan(16000 / 12)
  })

  it('ritmo 0 quando o mercado leva lá sozinho (não conta como expirado)', () => {
    const goal = { alvo: 4500, deadlineMK: '2028-6', categorias: ['etfs'], retornoAnual: 0.07 }
    const p = goalProgress(goal, SNAP, NOW) // 4000 a 7% em 25 meses ≈ 4614
    expect(p.ritmoNecessario).toBe(0)
    expect(p.expirado).toBe(false)
    expect(p.atingido).toBe(false)
  })
})

describe('goalActualPace', () => {
  const years = {
    2026: { months: {
      0: { poupanca: 4000, aforro: 1500 },  // jan: 5500
      3: { poupanca: 4600, aforro: 1700 },  // abr: 6300
    } },
  }
  it('usa o snapshot mais antigo da janela: (atual − base) / meses', () => {
    // NOW = jul (m=6); janela 6 → mais antigo disponível é jan (i=6)
    const r = goalActualPace({ categorias: ['poupanca', 'aforro'] }, years, 7000, 2026, 6)
    expect(r.months).toBe(6)
    expect(r.pace).toBeCloseTo((7000 - 5500) / 6, 6)
  })
  it('janela mais curta apanha o snapshot certo', () => {
    const r = goalActualPace({ categorias: ['poupanca', 'aforro'] }, years, 7000, 2026, 6, 3)
    expect(r.months).toBe(3) // abr
    expect(r.pace).toBeCloseTo((7000 - 6300) / 3, 6)
  })
  it('atravessa a fronteira do ano', () => {
    const y2 = { 2025: { months: { 11: { poupanca: 5000 } } } }
    const r = goalActualPace({ categorias: ['poupanca'] }, y2, 5600, 2026, 2)
    expect(r.months).toBe(3) // dez 2025 → mar 2026
    expect(r.pace).toBeCloseTo(200, 6)
  })
  it('null sem snapshots na janela', () => {
    expect(goalActualPace({ categorias: ['poupanca'] }, {}, 7000, 2026, 6)).toBeNull()
  })
})

describe('goalContributionPace', () => {
  // NOW: jul 2026 (m=6), janela 6 → fev..jul 2026
  const flowData = {
    stocks: {
      acoes: { holdings: [] },
      etfs: { holdings: [{ id: 'h1', ticker: 'VWCE', lots: [
        { buyMk: '2026-4', qty: 1, gasto: 300 },                       // mai — dentro
        { buyMk: '2026-5', qty: 1, gasto: 300 },                       // jun — dentro
        { buyMk: '2025-11', qty: 1, gasto: 999 },                      // dez 2025 — fora
        { buyMk: '2026-6', qty: -1, isSell: true, sellTotal: 100 },    // venda em jul — abate
      ] }] },
      bolsos: [{ id: 'b', name: 'B', entregas: [{ date: '2026-06-10', amount: 50 }] }],
    },
    ppr: { platforms: [{ id: 'p', name: 'P', accounts: [{ id: 'a', contributions: [
      { mk: '2026-5', valorPago: 100, valorColocado: 100 },
    ] }] }] },
    aforro: { certificates: [{ id: 'c', date: '2026-03-01', amount: 500 }] },
    crypto: { platforms: [{ id: 'cp', name: 'C', holdings: [{ id: 'ch', ticker: 'BTC', lots: [
      { qty: 0.01, gasto: 200, buyDate: '2026-06-20' },
    ] }] }] },
    years: { 2026: { months: { 0: { banco: 1000, poupanca: 2000 } } } },
  }
  const live = { banco: 1200, poupanca: 2400 }

  it('etfs: compras − vendas + entregas de bolsos, na janela', () => {
    const r = goalContributionPace({ categorias: ['etfs'] }, flowData, live, 2026, 6)
    expect(r.isFlow).toBe(true)
    expect(r.pace).toBeCloseTo((300 + 300 - 100 + 50) / 6, 6)
  })

  it('soma fluxos de várias categorias (ppr, aforro, crypto)', () => {
    const r = goalContributionPace({ categorias: ['etfs', 'ppr', 'aforro', 'crypto'] }, flowData, live, 2026, 6)
    expect(r.pace).toBeCloseTo((550 + 100 + 500 + 200) / 6, 6)
  })

  it('banco/poupança vão pela variação dos snapshots', () => {
    const r = goalContributionPace({ categorias: ['banco', 'poupanca'] }, flowData, live, 2026, 6)
    expect(r.pace).toBeCloseTo((1200 + 2400 - 3000) / 6, 6)
  })

  it('meta mista: fluxos + variação de caixa', () => {
    const r = goalContributionPace({ categorias: ['etfs', 'poupanca'] }, flowData, live, 2026, 6)
    expect(r.pace).toBeCloseTo(550 / 6 + (2400 - 2000) / 6, 6)
  })

  it('sem fluxos registados devolve ritmo 0 (honesto: não estás a reforçar)', () => {
    const r = goalContributionPace({ categorias: ['etfs'] }, { stocks: { etfs: { holdings: [] } } }, {}, 2026, 6)
    expect(r.pace).toBe(0)
  })

  it('null quando só há caixa e não existem snapshots', () => {
    expect(goalContributionPace({ categorias: ['poupanca'] }, {}, live, 2026, 6)).toBeNull()
  })
})

describe('monthsToReach', () => {
  it('linear: teto de falta/ritmo', () => {
    expect(monthsToReach(7000, 20000, 500, 0)).toBe(26)
    expect(monthsToReach(7000, 20000, 500)).toBe(26)
  })
  it('0 se já atingido; null com ritmo ≤ 0 sem retorno', () => {
    expect(monthsToReach(20000, 20000, 500, 0)).toBe(0)
    expect(monthsToReach(7000, 20000, 0, 0)).toBeNull()
    expect(monthsToReach(7000, 20000, -100, 0)).toBeNull()
  })
  it('com retorno composto chega mais cedo do que o linear', () => {
    const n = monthsToReach(7000, 20000, 500, 0.07)
    expect(n).toBeLessThan(26)
    expect(n).toBeGreaterThan(12)
  })
  it('só com crescimento (ritmo 0 e retorno > 0)', () => {
    // 10000 a 7%/ano duplica em ~123 meses (regra dos 72: 72/7 ≈ 10,3 anos)
    const n = monthsToReach(10000, 20000, 0, 0.07)
    expect(n).toBeGreaterThan(118)
    expect(n).toBeLessThan(128)
  })
  it('null quando demora mais do que maxMonths ou nunca converge', () => {
    expect(monthsToReach(100, 1e9, 0, 0.07, 1200)).toBeNull()
    expect(monthsToReach(0, 20000, 0, 0.07)).toBeNull()
    expect(monthsToReach(7000, 20000, -100, 0.07)).toBeNull()
  })
})

describe('GOAL_CATEGORY_LABELS', () => {
  it('cobre as 7 categorias do Dashboard', () => {
    expect(Object.keys(GOAL_CATEGORY_LABELS)).toEqual(
      ['poupanca', 'aforro', 'acoes', 'etfs', 'ppr', 'banco', 'crypto'])
  })
})
