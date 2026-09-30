import { describe, it, expect } from 'vitest'
import { computeUpcomingEvents, buildEventsNotification } from '../upcomingEvents.js'
import { runwayMonths } from '../calc/incomeCalc.js'

const NOW = new Date(2026, 6, 15) // 15 jul 2026

describe('computeUpcomingEvents', () => {
  it('débito de dívida ainda este mês e no seguinte', () => {
    const data = { debts: [{ id: 'd1', nome: 'Carro', ativa: true, diaDebito: 20, prestacaoMensal: 200, montanteInicial: 1000 }] }
    const evs = computeUpcomingEvents(data, NOW, 60)
    expect(evs).toHaveLength(2) // 20 jul + 20 ago
    expect(evs[0].date.getDate()).toBe(20)
    expect(evs[0].amount).toBe(200)
  })

  it('dívida inativa ou ainda não iniciada não gera eventos', () => {
    const data = { debts: [
      { id: 'd1', nome: 'X', ativa: false, diaDebito: 20, prestacaoMensal: 100 },
      { id: 'd2', nome: 'Y', ativa: true, diaDebito: 20, prestacaoMensal: 100, inicioMK: '2027-0' },
    ] }
    expect(computeUpcomingEvents(data, NOW, 60)).toHaveLength(0)
  })

  it('juros trimestrais do aforro dentro do horizonte', () => {
    // Subscrito a 1 mai 2026 → próximo pagamento ~1 ago 2026
    const data = { aforro: { euribor: 0.02, certificates: [{ id: 'c1', date: '2026-05-01', amount: 1000 }] } }
    const evs = computeUpcomingEvents(data, NOW, 90)
    expect(evs.some(e => e.label.includes('Juros do aforro'))).toBe(true)
  })

  it('prazo PPR só aparece com horizonte a alcançar 31 dez e teto por atingir', () => {
    const data = {
      profile: { birthYear: 1995 },
      ppr: { platforms: [{ id: 'p', name: 'X', accounts: [{ id: 'a', contributions: [
        { mk: '2026-1', valorPago: 100, valorColocado: 100 },
      ] }] }] },
    }
    expect(computeUpcomingEvents(data, NOW, 90).some(e => e.label.includes('PPR'))).toBe(false)   // 31 dez fora de 90d
    expect(computeUpcomingEvents(data, new Date(2026, 10, 1), 90).some(e => e.label.includes('PPR'))).toBe(true)
  })

  it('ordena cronologicamente e limita', () => {
    const data = { debts: [
      { id: 'a', nome: 'A', ativa: true, diaDebito: 25, prestacaoMensal: 1, montanteInicial: 1 },
      { id: 'b', nome: 'B', ativa: true, diaDebito: 18, prestacaoMensal: 1, montanteInicial: 1 },
    ] }
    const evs = computeUpcomingEvents(data, NOW, 30)
    expect(evs[0].label).toContain('B') // dia 18 antes do dia 25
  })

  it('robusto sem dados', () => {
    expect(computeUpcomingEvents(null)).toEqual([])
    expect(computeUpcomingEvents({})).toEqual([])
  })
})

describe('buildEventsNotification', () => {
  it('null sem eventos', () => {
    expect(buildEventsNotification([])).toBeNull()
    expect(buildEventsNotification(null)).toBeNull()
  })

  it('linha por evento com data, rótulo e valor (≈ para estimativas)', () => {
    const n = buildEventsNotification([
      { date: new Date(2026, 6, 17), label: 'Prestação «Carro»', amount: 200 },
      { date: new Date(2026, 6, 18), label: 'Juros do aforro', amount: 12.5, approx: true },
    ])
    expect(n.title).toContain('2 eventos')
    expect(n.body).toContain('17/7 · Prestação «Carro»')
    expect(n.body).toContain('≈')
  })

  it('corta a 4 linhas e resume o resto', () => {
    const evs = Array.from({ length: 6 }, (_, i) => ({ date: new Date(2026, 6, 15 + i), label: `E${i}` }))
    const n = buildEventsNotification(evs)
    expect(n.body.split('\n')).toHaveLength(5)
    expect(n.body).toContain('mais 2')
  })

  it('singular com um só evento', () => {
    const n = buildEventsNotification([{ date: new Date(2026, 6, 17), label: 'X' }])
    expect(n.title).toBe('Thrive — evento próximo')
  })
})

describe('runwayMonths', () => {
  it('liquidez ÷ despesas', () => {
    expect(runwayMonths(6000, 1000)).toBe(6)
    expect(runwayMonths(1500, 1000)).toBe(1.5)
  })
  it('null sem despesas definidas', () => {
    expect(runwayMonths(6000, 0)).toBeNull()
    expect(runwayMonths(6000, null)).toBeNull()
  })
})
