import { describe, it, expect } from 'vitest'
import { parseXtb, buildXtbPlan, applyXtbImport, collectSrcIds, serialToMk, xtbCurrency } from '../importXtb.js'

// Serial Excel: 2026-07-10 ≈ 46213 (validado contra ficheiros reais XTB)
const S_JUL10 = 46213.31
const S_JUL01 = 46204.41

// ── Fixture formato A (zip anual) ──
const anual = {
  'Cash Operations': [
    ['Account number', '12345678'],
    ['Cash Operations', ''],
    ['Date from (UTC)', 46023],
    ['Date to (UTC)', 46217.77],
    ['Type', 'Ticker', 'Instrument', 'Time', 'Amount', 'ID', 'Comment', 'Product'],
    ['Stock purchase', 'VWRL.NL', 'FTSE All-World', S_JUL10, -105.03, '111', 'OPEN BUY 0.6542 @ 160.54', 'My Trades'],
    ['Stock purchase', 'EGLN.UK', 'Gold ETC', S_JUL10, -25, '112', 'OPEN BUY 3/3.2736 @ 137.230', 'My Trades'], // execução parcial
    ['Deposit', '', '', S_JUL10, 100, '113', 'JP_MORGAN deposit', 'My Trades'],
    ['Withholding tax', 'NVG.PT', 'Navigator', S_JUL01, -0.4, '114', 'NVG.PT EUR WHT 35%', 'My Trades'],
    ['Dividend', 'NVG.PT', 'Navigator', S_JUL01, 1.13, '115', 'NVG.PT EUR 0.1125/ SHR', 'My Trades'],
    ['Dividend', 'VWRL.NL', 'FTSE All-World', S_JUL01, 0.5, '116', 'VWRL.NL USD 0.9055/ SHR', 'My Trades'],
    ['Dividend', 'VWRL.NL', 'FTSE All-World', S_JUL01, 0.51, '117', 'VWRL.NL USD 0.9055/ SHR', 'My Trades'],
  ],
  'Closed Positions': [
    ['Account', '12345678'],
    ['Closed Positions', ''],
    ['Date from (UTC)', 46023],
    ['Date to (UTC)', 46217.77],
    ['Instrument', 'Category', 'Ticker', 'Type', 'Volume', 'Open Price', 'Open Time (UTC)', 'Close Price', 'Close Time (UTC)', 'Product', 'Profit/Loss', 'Gross Profit', 'Purchase Value', 'Sale Value'],
    ['FTSE All-World', 'ETF', 'VWCE.DE', 'BUY', 0.326, 151.84, 46129.4, 153.26, 46133.29, 'Investment Plans', 0.46, 0.46, 49.5, 49.96],
  ],
}

// ── Fixture formato B (statement mensal) ──
const mensal = {
  'CASH OPERATION HISTORY': [
    [], [], [], [],
    ['', '', 'Name and surname', 'Account', 'Currency', '', 46217.85],
    ['', '', 'Test User', '12345678', 'EUR', '', ''],
    ['', '', 'Balance', 'Equity', 'Margin', 'Free margin', 'Margin level'],
    ['', '', 10, 1000, 0, 10, 0],
    ['CASH OPERATION HISTORY ', null, null, null, '', ''],
    ['14/06/2026 - 15/07/2026', null, null, '', '', '', ''],
    ['ID', 'Type', 'Time', 'Comment', 'Symbol', 'Amount', ''],
    [222, 'Stock purchase', S_JUL10, 'OPEN BUY 0.6233 @ 160.42', 'VWRL.NL', -99.99, ''],
    [223, 'DIVIDENT', S_JUL01, 'UNA.NL EUR 0.4664/ SHR', 'UNA.NL', 0.47, ''],
  ],
}

describe('helpers', () => {
  it('serialToMk converte serial Excel para mk 0-indexed', () => {
    expect(serialToMk(S_JUL10)).toBe('2026-6') // julho = 6
  })
  it('xtbCurrency infere pela terminação', () => {
    expect(xtbCurrency('NKE.US')).toBe('USD')
    expect(xtbCurrency('EGLN.UK')).toBe('GBP')
    expect(xtbCurrency('VWCE.DE')).toBe('EUR')
  })
})

describe('parseXtb — formato anual', () => {
  const p = parseXtb(anual)

  it('extrai compras (incluindo execuções parciais qty/total)', () => {
    expect(p.buys).toHaveLength(2)
    const parcial = p.buys.find(b => b.ticker === 'EGLN.UK')
    expect(parcial.qty).toBe(3)
    expect(parcial.price).toBeCloseTo(137.23, 2)
    expect(parcial.gasto).toBe(25)
    expect(p.warnings).toHaveLength(0)
  })

  it('agrega dividendos por ticker+dia e abate a retenção', () => {
    const nvg = p.dividends.find(d => d.ticker === 'NVG.PT')
    expect(nvg.amount).toBeCloseTo(0.73, 2)  // 1.13 − 0.40
    expect(nvg.tax).toBeCloseTo(0.4, 2)
    const vwrl = p.dividends.find(d => d.ticker === 'VWRL.NL')
    expect(vwrl.amount).toBeCloseTo(1.01, 2) // 0.5 + 0.51 numa só entrada
  })

  it('extrai vendas das closed positions com valores exatos', () => {
    expect(p.sells).toHaveLength(1)
    expect(p.sells[0].saleValue).toBe(49.96)
    expect(p.sells[0].qty).toBe(0.326)
  })
})

describe('parseXtb — formato mensal (statement)', () => {
  const p = parseXtb(mensal)
  it('reconhece as colunas por nome apesar do preâmbulo', () => {
    expect(p.buys).toHaveLength(1)
    expect(p.buys[0].ticker).toBe('VWRL.NL')
    expect(p.dividends).toHaveLength(1)
    expect(p.dividends[0].amount).toBe(0.47)
  })
})

describe('buildXtbPlan / applyXtbImport', () => {
  const empty = { stocks: { acoes: { holdings: [] }, etfs: { holdings: [] } } }
  const parsed = parseXtb(anual)

  it('plano sugere ETF via Category das closed positions', () => {
    const plan = buildXtbPlan(empty, parsed)
    expect(plan.find(r => r.ticker === 'VWCE.DE').category).toBe('etfs')
    expect(plan.every(r => r.isNew)).toBe(true)
  })

  it('aplica: cria holdings, lots, sells e dividendos', () => {
    const { patch, counts } = applyXtbImport(empty, parsed, { 'VWRL.NL': 'etfs', 'VWCE.DE': 'etfs' })
    expect(counts).toMatchObject({ buys: 2, sells: 1, dividends: 2, newHoldings: 4, skipped: 0 })
    const vwrl = patch.stocks.etfs.holdings.find(h => h.ticker === 'VWRL.NL')
    expect(vwrl.platform).toBe('XTB')
    expect(vwrl.lots[0]).toMatchObject({ buyMk: '2026-6', qty: 0.6542, gasto: 105.03 })
    expect(vwrl.dividends[0].tax).toBeUndefined() // VWRL sem WHT nesta fixture
    const vwce = patch.stocks.etfs.holdings.find(h => h.ticker === 'VWCE.DE')
    expect(vwce.lots[0]).toMatchObject({ isSell: true, qty: -0.326, sellTotal: 49.96 })
  })

  it('reimportar é idempotente (dedupe por srcId)', () => {
    const { patch } = applyXtbImport(empty, parsed, {})
    const { counts } = applyXtbImport({ stocks: patch.stocks }, parsed, {})
    expect(counts.buys + counts.sells + counts.dividends).toBe(0)
    expect(counts.skipped).toBe(5)
  })

  it('subconjunto filtrado (preview da Inbox): importa só as linhas escolhidas', () => {
    // Desmarcar tudo menos as compras do VWRL: não cria holdings dos
    // outros tickers, não importa vendas nem dividendos
    const subset = {
      buys: parsed.buys.filter(b => b.ticker === 'VWRL.NL'),
      sells: [], dividends: [], warnings: [],
    }
    const { patch, counts } = applyXtbImport(empty, subset, { 'VWRL.NL': 'etfs' })
    expect(counts).toMatchObject({ buys: 1, sells: 0, dividends: 0, newHoldings: 1 })
    expect(patch.stocks.etfs.holdings).toHaveLength(1)
    expect(patch.stocks.acoes.holdings).toHaveLength(0)
  })

  it('collectSrcIds apanha srcId de lotes e dividendos nas duas categorias', () => {
    const { patch } = applyXtbImport(empty, parsed, { 'VWRL.NL': 'etfs' })
    const ids = collectSrcIds({ stocks: patch.stocks })
    // 2 compras + 1 venda + 2 dividendos da fixture anual
    expect(ids.size).toBe(5)
    for (const b of parsed.buys) expect(ids.has(b.srcId)).toBe(true)
    for (const d of parsed.dividends) expect(ids.has(d.srcId)).toBe(true)
    expect(collectSrcIds({}).size).toBe(0)
  })

  it('funde em holdings existentes sem mexer na categoria', () => {
    const existing = {
      stocks: {
        acoes: { holdings: [] },
        etfs: { holdings: [{ id: 'h1', ticker: 'VWRL.NL', name: 'Vanguard', lots: [], dividends: [] }] },
      },
    }
    const { patch, counts } = applyXtbImport(existing, parseXtb(mensal), {})
    expect(counts.newHoldings).toBe(1) // só UNA.NL
    const vwrl = patch.stocks.etfs.holdings.find(h => h.ticker === 'VWRL.NL')
    expect(vwrl.id).toBe('h1')          // manteve a holding
    expect(vwrl.lots).toHaveLength(1)   // ganhou o lote novo
  })
})
