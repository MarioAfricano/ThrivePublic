import { describe, it, expect } from 'vitest'
import { computeReminders, aforroMaturity } from '../reminders.js'

// `now` fixo: 15 de julho de 2026
const NOW = new Date(2026, 6, 15)
const ids = (data, now = NOW) => computeReminders(data, now).map(r => r.id)

describe('aforroMaturity', () => {
  it('série E (antes de jun 2023) → 10 anos', () => {
    const m = aforroMaturity('2020-03-10')
    expect(m.serie).toBe('E')
    expect(m.maturity.getFullYear()).toBe(2030)
  })
  it('série F (desde jun 2023) → 15 anos', () => {
    const m = aforroMaturity('2023-08-01')
    expect(m.serie).toBe('F')
    expect(m.maturity.getFullYear()).toBe(2038)
  })
  it('null para data inválida', () => {
    expect(aforroMaturity('abc')).toBeNull()
  })
})

describe('mês anterior por fechar', () => {
  it('avisa quando junho tem snapshot mas não está fechado', () => {
    const data = { years: { 2026: { lockedMonths: [], months: { 5: { banco: 100 } } } } }
    expect(ids(data)).toContain('close-prev-month')
  })
  it('não avisa se está fechado ou sem snapshot', () => {
    expect(ids({ years: { 2026: { lockedMonths: [5], months: { 5: { banco: 100 } } } } })).not.toContain('close-prev-month')
    expect(ids({ years: { 2026: { lockedMonths: [], months: {} } } })).not.toContain('close-prev-month')
  })
  it('em janeiro olha para dezembro do ano anterior', () => {
    const data = { years: { 2025: { lockedMonths: [], months: { 11: { banco: 100 } } } } }
    expect(ids(data, new Date(2026, 0, 10))).toContain('close-prev-month')
  })
})

describe('aforro perto da maturidade', () => {
  it('info quando faltam menos de 180 dias', () => {
    // série E subscrita em out 2016 → maturidade out 2026 (3 meses depois de NOW)
    const data = { aforro: { certificates: [{ id: 'c1', date: '2016-10-01', amount: 5000 }] } }
    const r = computeReminders(data, NOW).find(x => x.id === 'aforro-maturing-c1')
    expect(r).toBeTruthy()
    expect(r.severity).toBe('info')
  })
  it('warn quando já passou a maturidade', () => {
    const data = { aforro: { certificates: [{ id: 'c2', date: '2015-01-01', amount: 1000 }] } }
    const r = computeReminders(data, NOW).find(x => x.id === 'aforro-matured-c2')
    expect(r).toBeTruthy()
    expect(r.severity).toBe('warn')
  })
  it('silencioso quando falta mais de meio ano', () => {
    const data = { aforro: { certificates: [{ id: 'c3', date: '2024-01-01', amount: 1000 }] } }
    expect(ids(data)).toHaveLength(0)
  })
})

describe('teto PPR no fim do ano', () => {
  const pprData = {
    profile: { birthYear: 1995 },
    ppr: { platforms: [{ id: 'p', name: 'X', accounts: [{ id: 'a', contributions: [
      { mk: '2026-1', valorPago: 500, valorColocado: 500 },
    ] }] }] },
  }
  it('lembra em novembro quando o teto não está atingido', () => {
    expect(ids(pprData, new Date(2026, 10, 5))).toContain('ppr-teto')
  })
  it('silencioso antes de outubro e quando o teto está atingido', () => {
    expect(ids(pprData, NOW)).not.toContain('ppr-teto') // julho
    const maxed = { ...pprData, ppr: { platforms: [{ id: 'p', name: 'X', accounts: [{ id: 'a', contributions: [
      { mk: '2026-1', valorPago: 2500, valorColocado: 2500 },
    ] }] }] } }
    expect(ids(maxed, new Date(2026, 10, 5))).not.toContain('ppr-teto')
  })
  it('silencioso sem ano de nascimento', () => {
    const semIdade = { ...pprData, profile: {} }
    expect(ids(semIdade, new Date(2026, 10, 5))).not.toContain('ppr-teto')
  })
})

describe('prestação de dívida pendente', () => {
  const debt = (extra) => ({
    debts: [{ id: 'd1', nome: 'Carro', ativa: true, diaDebito: 8,
      montanteInicial: 10000, prestacaoMensal: 200, pagamentos: {}, ...extra }],
  })
  it('avisa depois do dia de débito sem pagamento registado', () => {
    expect(ids(debt())).toContain('debt-d1') // dia 15 > dia 8
  })
  it('silencioso antes do dia de débito', () => {
    expect(ids(debt(), new Date(2026, 6, 5))).not.toContain('debt-d1')
  })
  it('silencioso com pagamento registado (formato novo e legado)', () => {
    expect(ids(debt({ pagamentos: { '2026-6': [{ id: 'p1', valor: 200 }] } }))).not.toContain('debt-d1')
    expect(ids(debt({ pagamentos: { '2026-6': { pago: true, valor: 200 } } }))).not.toContain('debt-d1')
  })
  it('silencioso para dívidas inativas ou ainda não iniciadas', () => {
    expect(ids(debt({ ativa: false }))).not.toContain('debt-d1')
    expect(ids(debt({ inicioMK: '2026-9' }))).not.toContain('debt-d1')
  })
})

describe('robustez', () => {
  it('devolve [] sem dados', () => {
    expect(computeReminders(null)).toEqual([])
    expect(computeReminders({})).toEqual([])
  })
})
