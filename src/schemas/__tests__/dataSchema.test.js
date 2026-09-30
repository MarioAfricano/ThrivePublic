import { describe, it, expect } from 'vitest'
import {
  AccountSchema,
  BankPlatformSchema,
  HoldingSchema,
  StockLotSchema,
  CryptoPlatformSchema,
  PPRPlatformSchema,
  AforroProductSchema,
  DebtSchema,
  DataSchema,
  validateData,
} from '../index.js'

// ── AccountSchema ──────────────────────────────────────────────────
describe('AccountSchema', () => {
  it('aceita conta mínima válida', () => {
    expect(AccountSchema.safeParse({ id: 'a1', type: 'conta' }).success).toBe(true)
  })

  it('aceita conta poupança com todos os campos', () => {
    const acc = {
      id: 'a2', name: 'Poupança', type: 'poupanca',
      currency: 'EUR', balance: 1000, interest: 50,
      rateToEUR: 1.0, taxRate: 0.28,
      startMK: '2024-0', deletedFromMK: '2025-11',
      monthData: { '2024-0': { balance: 900, interest: 40, rateToEUR: 1.0 } },
    }
    expect(AccountSchema.safeParse(acc).success).toBe(true)
  })

  it('rejeita type inválido', () => {
    expect(AccountSchema.safeParse({ id: 'a3', type: 'corrente' }).success).toBe(false)
  })

  it('rejeita id em falta', () => {
    expect(AccountSchema.safeParse({ type: 'conta' }).success).toBe(false)
  })

  it('aceita campos extra (passthrough)', () => {
    expect(AccountSchema.safeParse({ id: 'a4', type: 'conta', campoNovo: true }).success).toBe(true)
  })
})

// ── BankPlatformSchema ─────────────────────────────────────────────
describe('BankPlatformSchema', () => {
  it('aceita plataforma válida com contas vazias', () => {
    expect(BankPlatformSchema.safeParse({ id: 'p1', name: 'CGD', accounts: [] }).success).toBe(true)
  })

  it('rejeita se accounts não for array', () => {
    expect(BankPlatformSchema.safeParse({ id: 'p2', name: 'BPI', accounts: null }).success).toBe(false)
  })
})

// ── StockLotSchema ─────────────────────────────────────────────────
describe('StockLotSchema', () => {
  it('aceita lot mínimo', () => {
    expect(StockLotSchema.safeParse({ qty: 10 }).success).toBe(true)
  })

  it('aceita sell lot', () => {
    const lot = { id: 'l1', buyMk: '2024-3', qty: -5, gasto: 0, isSell: true, sellTotal: 250 }
    expect(StockLotSchema.safeParse(lot).success).toBe(true)
  })

  it('rejeita qty em falta', () => {
    expect(StockLotSchema.safeParse({ id: 'l2', gasto: 100 }).success).toBe(false)
  })
})

// ── HoldingSchema ──────────────────────────────────────────────────
describe('HoldingSchema', () => {
  it('aceita holding com lots', () => {
    const h = {
      id: 'h1', ticker: 'AAPL', name: 'Apple',
      lots: [{ qty: 5, price: 180, gasto: 900, buyMk: '2024-0' }],
      price: 185, platform: 'DEGIRO', currency: 'USD',
    }
    expect(HoldingSchema.safeParse(h).success).toBe(true)
  })

  it('aceita holding legado sem lots', () => {
    const h = { id: 'h2', ticker: 'VOD', qty: 100, gasto: 500 }
    expect(HoldingSchema.safeParse(h).success).toBe(true)
  })

  it('aceita dividendos', () => {
    const h = {
      id: 'h3', ticker: 'JNJ',
      dividends: [{ mk: '2024-6', amount: 12.5 }],
    }
    expect(HoldingSchema.safeParse(h).success).toBe(true)
  })

  it('aceita gastoOverrideByMk', () => {
    const h = { id: 'h4', ticker: 'MSFT', gastoOverrideByMk: { '2024-0': 1234.56 } }
    expect(HoldingSchema.safeParse(h).success).toBe(true)
  })

  it('rejeita id em falta', () => {
    expect(HoldingSchema.safeParse({ ticker: 'X' }).success).toBe(false)
  })
})

// ── CryptoPlatformSchema ───────────────────────────────────────────
describe('CryptoPlatformSchema', () => {
  it('aceita plataforma cripto válida', () => {
    const p = {
      id: 'cp1', name: 'Binance',
      holdings: [{ id: 'ch1', ticker: 'BTC', price: 60000, lots: [{ qty: 0.1, gasto: 5000, buyDate: '2024-01-15' }] }],
    }
    expect(CryptoPlatformSchema.safeParse(p).success).toBe(true)
  })

  it('aceita holding sem lots (legado)', () => {
    const p = { id: 'cp2', name: 'Kraken', holdings: [{ id: 'ch2', ticker: 'ETH', qty: 2, gasto: 4000 }] }
    expect(CryptoPlatformSchema.safeParse(p).success).toBe(true)
  })
})

// ── PPRPlatformSchema ──────────────────────────────────────────────
describe('PPRPlatformSchema', () => {
  it('aceita plataforma PPR válida', () => {
    const p = {
      id: 'ppr1', name: 'Optimize', color: '#f472b6',
      accounts: [{
        id: 'pa1', name: 'PPR Acumulação', balance: 5000,
        contributions: [{ mk: '2024-0', valorPago: 500, valorColocado: 500 }],
      }],
    }
    expect(PPRPlatformSchema.safeParse(p).success).toBe(true)
  })

  it('aceita contas vazias', () => {
    expect(PPRPlatformSchema.safeParse({ id: 'ppr2', name: 'GNB', accounts: [] }).success).toBe(true)
  })
})

// ── AforroProductSchema ────────────────────────────────────────────
describe('AforroProductSchema', () => {
  it('aceita certificado válido', () => {
    const c = {
      id: 'af1', startDate: '2023-01-01', amount: 10000,
      rateHistory: { '0': 0.02, '3': 0.025 },
      valueOverride: null,
    }
    expect(AforroProductSchema.safeParse(c).success).toBe(true)
  })

  it('aceita valueOverride numérico', () => {
    const c = { id: 'af2', amount: 5000, valueOverride: 5200 }
    expect(AforroProductSchema.safeParse(c).success).toBe(true)
  })

  it('rejeita amount em falta', () => {
    expect(AforroProductSchema.safeParse({ id: 'af3' }).success).toBe(false)
  })
})

// ── DebtSchema ─────────────────────────────────────────────────────
describe('DebtSchema', () => {
  it('aceita dívida válida com pagamentos (formato novo)', () => {
    const d = {
      id: 'd1', nome: 'Habitação', banco: 'CGD',
      montanteInicial: 150000, prestacaoMensal: 650,
      diaDebito: 8, inicioMK: '2020-0', ativa: true,
      pagamentos: {
        '2024-0': [{ id: 'p1', valor: 650, saldoRestante: 130000 }],
        '2024-1': [{ id: 'p2', valor: 650, saldoRestante: 129350 }],
      },
    }
    expect(DebtSchema.safeParse(d).success).toBe(true)
  })

  it('aceita pagamentos no formato legado', () => {
    const d = {
      id: 'd2', nome: 'Carro', montanteInicial: 20000,
      prestacaoMensal: 300, ativa: true,
      pagamentos: { '2024-0': { pago: true, valor: 300, saldoRestante: 19700 } },
    }
    expect(DebtSchema.safeParse(d).success).toBe(true)
  })

  it('rejeita diaDebito fora do intervalo', () => {
    const d = { id: 'd3', nome: 'X', montanteInicial: 1000, prestacaoMensal: 100, ativa: true, diaDebito: 30 }
    expect(DebtSchema.safeParse(d).success).toBe(false)
  })

  it('rejeita se ativa não for boolean', () => {
    const d = { id: 'd4', nome: 'Y', montanteInicial: 1000, prestacaoMensal: 100, ativa: 'sim' }
    expect(DebtSchema.safeParse(d).success).toBe(false)
  })
})

// ── DataSchema (raiz) ──────────────────────────────────────────────
describe('DataSchema', () => {
  const minimal = { currentYear: 2025, currentMonth: 0 }

  it('aceita dados mínimos', () => {
    expect(DataSchema.safeParse(minimal).success).toBe(true)
  })

  it('rejeita currentMonth fora de [0,11]', () => {
    expect(DataSchema.safeParse({ currentYear: 2025, currentMonth: 12 }).success).toBe(false)
    expect(DataSchema.safeParse({ currentYear: 2025, currentMonth: -1 }).success).toBe(false)
  })

  it('aceita data completa com todas as secções', () => {
    const full = {
      schemaVersion: 1, version: '1.0',
      currentYear: 2025, currentMonth: 3,
      years: { '2025': { goal: 12000, lockedMonths: [0, 1], months: { '0': { banco: 5000, acoes: 10000 } } } },
      patrimony: { startOfYear: 45000 },
      banks: { platforms: [{ id: 'b1', name: 'CGD', accounts: [{ id: 'a1', type: 'conta', balance: 2000 }] }] },
      aforro: { euribor: 0.025, certificates: [{ id: 'af1', amount: 5000 }] },
      crypto: { platforms: [{ id: 'cp1', name: 'Binance', holdings: [] }] },
      ppr: { platforms: [{ id: 'ppr1', name: 'GNB', accounts: [] }] },
      stocks: {
        acoes: { holdings: [{ id: 'h1', ticker: 'AAPL', lots: [{ qty: 5, gasto: 900, buyMk: '2024-0' }] }] },
        etfs:  { holdings: [] },
        bolsos: [],
        freeFunds: [{ id: 'xtb', name: 'XTB', amount: 0 }],
      },
      debts: [{ id: 'd1', nome: 'Habitação', montanteInicial: 150000, prestacaoMensal: 650, ativa: true }],
      debtSettings: { showOnDashboard: false },
    }
    const result = DataSchema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('aceita campos extra (passthrough) sem falhar', () => {
    const d = { ...minimal, campoFuturo: 'alguma coisa', banks: { platforms: [], extraField: true } }
    expect(DataSchema.safeParse(d).success).toBe(true)
  })
})

// ── validateData helper ────────────────────────────────────────────
describe('validateData', () => {
  it('devolve valid:true para dados correctos', () => {
    const { valid, errors } = validateData({ currentYear: 2025, currentMonth: 0 }, 'test')
    expect(valid).toBe(true)
    expect(errors).toHaveLength(0)
  })

  it('devolve valid:false e errors para dados inválidos', () => {
    const { valid, errors } = validateData({ currentYear: 2025, currentMonth: 15 }, 'test')
    expect(valid).toBe(false)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('não lança mesmo com dados completamente inválidos', () => {
    expect(() => validateData(null, 'test')).not.toThrow()
    expect(() => validateData('string', 'test')).not.toThrow()
    expect(() => validateData({}, 'test')).not.toThrow()
  })

  it('devolve valid:false para objecto vazio (faltam campos obrigatórios)', () => {
    const { valid } = validateData({}, 'test')
    expect(valid).toBe(false)
  })
})
