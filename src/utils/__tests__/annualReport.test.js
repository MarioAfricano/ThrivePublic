import { describe, it, expect } from 'vitest'
import { buildAnnualReportHTML } from '../annualReport.js'

const data = {
  currentYear: 2026, currentMonth: 5,
  profile: { birthYear: 1995 },
  years: { 2026: { months: {
    0: { banco: 1000, etfs: 4000 },
    5: { banco: 1500, etfs: 4500 },
  } } },
  stocks: { acoes: { holdings: [
    { id: 'h1', ticker: 'AAPL', lots: [{ id: 'l1', buyMk: '2025-0', qty: 10, gasto: 1000 }],
      sellMk: '2026-2', sellTotal: 1400, sellQty: 10, sellPrice: 140,
      dividends: [{ id: 'd1', mk: '2026-1', amount: 36 }] },
  ] }, etfs: { holdings: [] } },
  ppr: { platforms: [{ id: 'p', name: 'X', accounts: [{ id: 'a', contributions: [
    { mk: '2026-1', valorPago: 800, valorColocado: 800 },
  ] }] }] },
  banks: { platforms: [] },
  aforro: { certificates: [] },
  crypto: { platforms: [] },
}

describe('buildAnnualReportHTML', () => {
  const html = buildAnnualReportHTML(data, 2026)

  it('documento HTML completo com título do ano', () => {
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Relatório anual 2026')
  })

  it('inclui as três secções', () => {
    expect(html).toContain('Património por mês')
    expect(html).toContain('Rendimentos e mais-valias (IRS)')
    expect(html).toContain('<h2>PPR</h2>')
  })

  it('mostra a evolução do ano (5 000 → 6 000)', () => {
    expect(html).toContain('Evolução no ano')
    expect(html).toMatch(/6[\s .]?000/) // total final, tolerante ao separador
  })

  it('inclui a dedução PPR estimada (800×20% = 160)', () => {
    expect(html).toContain('Dedução à coleta estimada')
    expect(html).toMatch(/160/)
  })

  it('ano sem dados produz relatório válido com aviso', () => {
    const out = buildAnnualReportHTML(data, 2020)
    expect(out).toContain('Sem snapshots mensais')
  })
})
