// @vitest-environment jsdom
// Sanity check de render das novas páginas/cartões: Projeção e o cartão
// de benefício fiscal do PPR montam sem crashar com dados mínimos.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AppContext } from '../context/AppContext.jsx'
import { INITIAL_DATA } from '../data/initialData.js'

let Projecao, TaxBenefitCard

// Timeout largo: o import de recharts + jsdom pode passar dos 10s default
// quando a máquina está sob carga (dev server, suite completa em paralelo).
beforeAll(async () => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  ;({ default: Projecao } = await import('../pages/Projecao.jsx'))
  ;({ default: TaxBenefitCard } = await import('../components/ppr/TaxBenefitCard.jsx'))
}, 30000)

afterEach(cleanup)

const ctx = (data) => ({
  data, saveData: vi.fn(), exchangeRates: null,
})

describe('Projecao', () => {
  it('monta com INITIAL_DATA sem crashar', () => {
    render(
      <AppContext.Provider value={ctx(INITIAL_DATA)}>
        <Projecao />
      </AppContext.Provider>
    )
    expect(screen.getByText('Projeção')).toBeTruthy()
    expect(screen.getByText('Contribuição mensal')).toBeTruthy()
  })

  it('mostra cenários de meta quando há target definido', () => {
    const data = { ...INITIAL_DATA, projection: { target: 100000, monthlyContribution: 500, annualReturn: 0.05 } }
    render(
      <AppContext.Provider value={ctx(data)}>
        <Projecao />
      </AppContext.Provider>
    )
    expect(screen.getByText(/Otimista/)).toBeTruthy()
    expect(screen.getByText(/Pessimista/)).toBeTruthy()
  })

  it('mostra linhas comparativas e tabela de marcos quando há cenários', () => {
    const data = { ...INITIAL_DATA, projection: { scenarios: [
      { id: 's1', nome: 'ETF Mundial', color: '#22d3ee', initial: 1000, amount: 100, every: 1, unit: 'month', annualReturn: 0.07, ter: 0.002, stepUp: 0.025 },
    ] } }
    render(
      <AppContext.Provider value={ctx(data)}>
        <Projecao />
      </AppContext.Provider>
    )
    expect(screen.getAllByText('ETF Mundial').length).toBeGreaterThan(0)
    expect(screen.getByText('Património real')).toBeTruthy()
    // stepUp com decimais renderiza sem arredondar
    expect(screen.getByText('2.5%')).toBeTruthy()
  })
})

describe('TaxBenefitCard', () => {
  const platforms = [
    { id: 'p1', name: 'X', accounts: [{ id: 'a1', contributions: [
      { id: 'c1', mk: '2026-2', valorPago: 1000, valorColocado: 1000 },
    ] }] },
  ]

  it('sem ano de nascimento pede-o e não mostra dedução', () => {
    render(<TaxBenefitCard platforms={platforms} year={2026} birthYear={undefined} onSetBirthYear={vi.fn()} />)
    expect(screen.getByText(/Define o teu ano de nascimento/)).toBeTruthy()
  })

  it('com ano de nascimento mostra a dedução (20% até ao teto)', () => {
    render(<TaxBenefitCard platforms={platforms} year={2026} birthYear={1995} onSetBirthYear={vi.fn()} />)
    // 1000 € investidos, idade a 1 jan = 30 → dedução 200 €
    expect(screen.getByText(/Dedução estimada/)).toBeTruthy()
    expect(screen.getAllByText(/200/).length).toBeGreaterThan(0)
    expect(screen.getByText(/menos de 35 anos/)).toBeTruthy()
  })
})
