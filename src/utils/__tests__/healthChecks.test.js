import { describe, it, expect } from 'vitest'
import {
  checkStocksQtySync,
  checkCryptoQtySync,
  checkUniqueIds,
  checkLockedMonthFxRates,
  checkLockedMonthSnapshots,
  checkCurrentMonthSanity,
  checkStockOversell,
  checkLotsSemBuyMk,
  checkSchemaValidation,
  runAllChecks,
} from '../healthChecks.js'

// Base de dados "limpa" — cada teste parte daqui e muta só o que precisa.
function baseData() {
  return {
    schemaVersion: 1,
    currentYear: 2026,
    currentMonth: 3,
    years: {},
    patrimony: { startOfYear: 0 },
    banks: { platforms: [] },
    stocks: { acoes: { holdings: [] }, etfs: { holdings: [] }, bolsos: [], freeFunds: [] },
    crypto: { platforms: [], years: {} },
    ppr: { platforms: [] },
    aforro: { certificates: [] },
    debts: [],
  }
}

// Aplica um patch ao estilo `saveData` (merge top-level).
function apply(data, patch) { return { ...data, ...patch } }

describe('healthChecks — base sã', () => {
  it('tudo passa com dados iniciais vazios', () => {
    const results = runAllChecks(baseData())
    expect(results.every(r => r.ok)).toBe(true)
  })

  it('runAllChecks com data null devolve []', () => {
    expect(runAllChecks(null)).toEqual([])
    expect(runAllChecks(undefined)).toEqual([])
  })
})

describe('checkStocksQtySync', () => {
  it('detecta holding com qty ≠ Σ lots', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [
      { id: 'h1', ticker: 'AAPL', qty: 10, lots: [{ id: 'l1', qty: 5 }, { id: 'l2', qty: 3 }] },
    ]
    const r = checkStocksQtySync(d)
    expect(r.ok).toBe(false)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].message).toContain('AAPL')
    expect(r.fixable).toBe(true)
  })

  it('ignora holdings sem lots (campo qty raíz é legítimo)', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [{ id: 'h1', ticker: 'AAPL', qty: 10 }]
    expect(checkStocksQtySync(d).ok).toBe(true)
  })

  it('ignora quando qty é null/undefined (sem conflito)', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [
      { id: 'h1', ticker: 'AAPL', lots: [{ id: 'l1', qty: 5 }] },
    ]
    expect(checkStocksQtySync(d).ok).toBe(true)
  })

  it('fix remove o campo qty das entradas conflituosas sem tocar nas outras', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [
      { id: 'h1', ticker: 'AAPL', qty: 10, lots: [{ qty: 5 }, { qty: 3 }] },  // conflito
      { id: 'h2', ticker: 'MSFT', qty: 4,  lots: [{ qty: 4 }] },              // OK
      { id: 'h3', ticker: 'GOOG', qty: 7 },                                    // sem lots
    ]
    const r = checkStocksQtySync(d)
    const patched = apply(d, r.fix(d))
    expect(patched.stocks.acoes.holdings[0].qty).toBeUndefined()
    expect(patched.stocks.acoes.holdings[1].qty).toBe(4)
    expect(patched.stocks.acoes.holdings[2].qty).toBe(7)
    // Depois do fix o check fica verde
    expect(checkStocksQtySync(patched).ok).toBe(true)
  })

  it('apanha problemas em ETFs também', () => {
    const d = baseData()
    d.stocks.etfs.holdings = [
      { id: 'e1', ticker: 'VWCE', qty: 100, lots: [{ qty: 50 }] },
    ]
    const r = checkStocksQtySync(d)
    expect(r.ok).toBe(false)
    expect(r.issues[0].message).toContain('etfs')
  })
})

describe('checkCryptoQtySync', () => {
  it('detecta crypto holding com qty ≠ Σ lots', () => {
    const d = baseData()
    d.crypto.platforms = [
      { id: 'p1', name: 'Binance', holdings: [
        { id: 'h1', ticker: 'BTC', qty: 0.5, lots: [{ qty: 0.3 }, { qty: 0.1 }] },
      ]},
    ]
    const r = checkCryptoQtySync(d)
    expect(r.ok).toBe(false)
    expect(r.fixable).toBe(true)
  })

  it('fix elimina o conflito e preserva outros holdings', () => {
    const d = baseData()
    d.crypto.platforms = [
      { id: 'p1', name: 'Binance', holdings: [
        { id: 'h1', ticker: 'BTC', qty: 0.5, lots: [{ qty: 0.3 }] },
        { id: 'h2', ticker: 'ETH', qty: 2,   lots: [{ qty: 2 }] },
      ]},
    ]
    const patched = apply(d, checkCryptoQtySync(d).fix(d))
    expect(patched.crypto.platforms[0].holdings[0].qty).toBeUndefined()
    expect(patched.crypto.platforms[0].holdings[1].qty).toBe(2)
  })
})

describe('checkUniqueIds', () => {
  it('passa quando todos os ids são únicos e presentes', () => {
    const d = baseData()
    d.banks.platforms = [
      { id: 'bp1', name: 'Millennium', accounts: [
        { id: 'a1', name: 'DO', type: 'conta' },
        { id: 'a2', name: 'Poupança', type: 'poupanca' },
      ]},
    ]
    d.stocks.acoes.holdings = [{ id: 'h1', ticker: 'AAPL' }]
    d.stocks.etfs.holdings  = [{ id: 'h1', ticker: 'VWCE' }]  // mesmo id mas coleções distintas
    expect(checkUniqueIds(d).ok).toBe(true)
  })

  it('detecta id duplicado dentro da mesma colecção', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [
      { id: 'h1', ticker: 'AAPL' },
      { id: 'h1', ticker: 'MSFT' },
    ]
    const r = checkUniqueIds(d)
    expect(r.ok).toBe(false)
    expect(r.issues[0].message).toMatch(/h1.*duplicado/)
  })

  it('detecta accounts duplicadas entre plataformas bancárias', () => {
    const d = baseData()
    d.banks.platforms = [
      { id: 'p1', name: 'A', accounts: [{ id: 'acc-x', name: 'X' }] },
      { id: 'p2', name: 'B', accounts: [{ id: 'acc-x', name: 'Y' }] },
    ]
    expect(checkUniqueIds(d).ok).toBe(false)
  })

  it('detecta entrada sem id', () => {
    const d = baseData()
    d.debts = [{ id: 'd1', name: 'Casa' }, { name: 'Carro' /* sem id */ }]
    const r = checkUniqueIds(d)
    expect(r.ok).toBe(false)
    expect(r.issues.some(i => i.message.includes('sem id'))).toBe(true)
  })

  it('fix regenera ids duplicados e em falta; depois o check fica verde', () => {
    const d = baseData()
    d.banks.platforms = [
      { id: 'dup', name: 'A', accounts: [{ id: 'acc', name: 'X' }] },
      { id: 'dup', name: 'B', accounts: [{ id: 'acc', name: 'Y' }] },
    ]
    d.debts = [{ name: 'sem-id' }, { id: 'd1', name: 'ok' }]
    const r = checkUniqueIds(d)
    const patched = apply(d, r.fix(d))

    const bankIds = patched.banks.platforms.map(p => p.id)
    expect(new Set(bankIds).size).toBe(2)
    const accIds = patched.banks.platforms.flatMap(p => p.accounts.map(a => a.id))
    expect(new Set(accIds).size).toBe(2)
    expect(patched.debts.every(d => d.id)).toBe(true)
    expect(new Set(patched.debts.map(d => d.id)).size).toBe(2)

    expect(checkUniqueIds(patched).ok).toBe(true)
  })
})

describe('checkLockedMonthFxRates', () => {
  it('passa quando não há meses fechados', () => {
    const d = baseData()
    d.banks.platforms = [{ id: 'p1', name: 'A', accounts: [{ id: 'a1', name: 'USD', currency: 'USD', balance: 1000 }] }]
    expect(checkLockedMonthFxRates(d).ok).toBe(true)
  })

  it('passa quando a conta é EUR (não precisa de taxa)', () => {
    const d = baseData()
    d.years = { 2026: { lockedMonths: [0], months: {} } }
    d.banks.platforms = [{ id: 'p1', name: 'A', accounts: [{ id: 'a1', name: 'DO', currency: 'EUR', balance: 500 }] }]
    expect(checkLockedMonthFxRates(d).ok).toBe(true)
  })

  it('detecta conta USD sem rateToEUR em mês fechado', () => {
    const d = baseData()
    d.years = { 2026: { lockedMonths: [0], months: {} } }
    d.banks.platforms = [{
      id: 'p1', name: 'BBVA',
      accounts: [{
        id: 'a1', name: 'USD', currency: 'USD',
        monthData: { '2026-0': { balance: 1000 } },  // sem rateToEUR
      }],
    }]
    const r = checkLockedMonthFxRates(d)
    expect(r.ok).toBe(false)
    expect(r.issues[0].message).toContain('USD')
    expect(r.issues[0].message).toContain('2026-0')
  })

  it('aceita rateToEUR na raiz da conta como fallback', () => {
    const d = baseData()
    d.years = { 2026: { lockedMonths: [0], months: {} } }
    d.banks.platforms = [{
      id: 'p1', name: 'BBVA',
      accounts: [{ id: 'a1', name: 'USD', currency: 'USD', rateToEUR: 0.92 }],
    }]
    expect(checkLockedMonthFxRates(d).ok).toBe(true)
  })

  it('ignora contas criadas depois ou apagadas antes do mês fechado', () => {
    const d = baseData()
    d.years = { 2026: { lockedMonths: [0], months: {} } }
    d.banks.platforms = [{
      id: 'p1', name: 'A', accounts: [
        { id: 'a1', name: 'Futura',  currency: 'USD', startMK: '2026-5' },    // criada depois
        { id: 'a2', name: 'Antiga', currency: 'USD', deletedFromMK: '2025-0' }, // apagada antes
      ],
    }]
    expect(checkLockedMonthFxRates(d).ok).toBe(true)
  })
})

describe('checkLockedMonthSnapshots', () => {
  it('passa quando todos os meses fechados têm snapshot', () => {
    const d = baseData()
    d.years = { 2026: { lockedMonths: [0, 1], months: { 0: { banco: 100 }, 1: { banco: 200 } } } }
    expect(checkLockedMonthSnapshots(d).ok).toBe(true)
  })

  it('detecta mês fechado sem snapshot', () => {
    const d = baseData()
    d.years = { 2026: { lockedMonths: [3], months: {} } }
    const r = checkLockedMonthSnapshots(d)
    expect(r.ok).toBe(false)
    expect(r.issues[0].message).toContain('2026')
    expect(r.issues[0].message).toContain('mês 3')
  })
})

describe('checkCurrentMonthSanity', () => {
  it('passa com valores razoáveis', () => {
    const d = baseData()
    expect(checkCurrentMonthSanity(d, new Date('2026-04-18')).ok).toBe(true)
  })

  it('falha se currentMonth fora de [0,11]', () => {
    const d = baseData(); d.currentMonth = 12
    expect(checkCurrentMonthSanity(d).ok).toBe(false)
  })

  it('falha se currentYear demasiado antigo ou futuro', () => {
    const now = new Date('2026-04-18')
    expect(checkCurrentMonthSanity({ ...baseData(), currentYear: 1999 }, now).ok).toBe(false)
    expect(checkCurrentMonthSanity({ ...baseData(), currentYear: 2100 }, now).ok).toBe(false)
  })

  it('aceita o ano seguinte (planeamento anual)', () => {
    const now = new Date('2026-04-18')
    expect(checkCurrentMonthSanity({ ...baseData(), currentYear: 2027, currentMonth: 0 }, now).ok).toBe(true)
  })
})

describe('checkStockOversell', () => {
  it('passa quando Σ qty ≥ 0', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [
      { id: 'h1', ticker: 'AAPL', lots: [{ qty: 10 }, { isSell: true, qty: -3 }] },
    ]
    expect(checkStockOversell(d).ok).toBe(true)
  })

  it('detecta qty total negativa', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [
      { id: 'h1', ticker: 'AAPL', lots: [{ qty: 5 }, { isSell: true, qty: -10 }] },
    ]
    const r = checkStockOversell(d)
    expect(r.ok).toBe(false)
    expect(r.issues[0].message).toContain('AAPL')
  })
})

describe('runAllChecks — integração', () => {
  it('agrega todos os checks em ordem estável', () => {
    const results = runAllChecks(baseData())
    const ids = results.map(r => r.id)
    expect(ids).toEqual([
      'current-month-sanity',
      'unique-ids',
      'stocks-qty-sync',
      'crypto-qty-sync',
      'stocks-oversell',
      'locked-fx-rates',
      'locked-snapshots',
      'lots-sem-buymk',
      'schema-validation',
    ])
  })

  it('sinaliza todos os problemas num cenário com múltiplos erros', () => {
    const d = baseData()
    d.currentMonth = 99
    d.stocks.acoes.holdings = [
      { id: 'dup', ticker: 'A', qty: 5, lots: [{ qty: 3 }] },
      { id: 'dup', ticker: 'B' },  // id duplicado
    ]
    const results = runAllChecks(d)
    const failing = results.filter(r => !r.ok).map(r => r.id)
    expect(failing).toContain('current-month-sanity')
    expect(failing).toContain('stocks-qty-sync')
    expect(failing).toContain('unique-ids')
  })
})

describe('checkSchemaValidation', () => {
  it('ok com dados válidos', () => {
    expect(checkSchemaValidation(baseData()).ok).toBe(true)
  })

  it('sinaliza violações do schema com o caminho do campo', () => {
    const d = baseData()
    d.currentMonth = 99 // fora de 0..11
    const r = checkSchemaValidation(d)
    expect(r.ok).toBe(false)
    expect(r.severity).toBe('error')
    expect(r.issues[0].message).toContain('currentMonth')
  })
})

describe('checkLotsSemBuyMk', () => {
  it('ok quando todos os lots têm buyMk', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [{ id: 'h1', ticker: 'AAPL', lots: [
      { id: 'l1', buyMk: '2025-3', qty: 10, gasto: 1000 },
    ] }]
    expect(checkLotsSemBuyMk(d).ok).toBe(true)
  })

  it('sinaliza lots de compra e de venda sem buyMk, sem autofix', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [{ id: 'h1', ticker: 'AAPL', lots: [
      { id: 'l1', qty: 10, gasto: 1000 },                    // compra sem mês
      { id: 'l2', qty: -5, isSell: true, sellTotal: 600 },   // venda sem mês
      { id: 'l3', buyMk: '2025-3', qty: 2, gasto: 200 },     // ok
    ] }]
    d.stocks.etfs.holdings = [{ id: 'h2', ticker: 'VWCE', lots: [
      { id: 'l4', qty: 1, gasto: 100 },                      // etf sem mês
    ] }]
    const r = checkLotsSemBuyMk(d)
    expect(r.ok).toBe(false)
    expect(r.issues).toHaveLength(3)
    expect(r.fixable).toBe(false)
    expect(r.issues[0].message).toContain('AAPL')
    expect(r.issues[1].message).toContain('de venda')
  })

  it('ignora holdings legados sem lots', () => {
    const d = baseData()
    d.stocks.acoes.holdings = [{ id: 'h1', ticker: 'OLD', qty: 5, gasto: 500 }]
    expect(checkLotsSemBuyMk(d).ok).toBe(true)
  })
})
