// ── IRS helpers (Portugal) ────────────────────────────────────────
// Parte 1: Rendimentos de Capitais (Cat. E) — dividendos, juros bancários, Aforro.
// Parte 2: Mais-valias (Cat. G) — ações/ETFs (PMP), crypto (FIFO < 1a vs ≥ 1a).
//
// Notas:
//   - Dividendos: valor recebido como líquido quando há retenção, bruto quando não.
//     `tax` é opcional; se ausente, retenção estimada a 28 % (taxa padrão PT).
//   - Juros bancários: lidos de acc.monthData[mk].interestHistory[].
//   - Juros de Aforro: diferença de valor entre Dez(Y) e Dez(Y-1).
//   - Mais-valias Ações/ETFs: PMP (preço médio ponderado) — método PT para ações.
//   - Mais-valias Crypto: FIFO. Lotes ≥ 365 dias isentos (regime PT desde 2023).
//     As vendas são gravadas em h.salesHistory[] aquando da execução.
//
// Este módulo é puro — sem I/O nem React.

import { mkToNum } from '../dateUtils.js'
import { AFORRO_IRS_RATE, calcAforroValueAt } from './savingsCalc.js'
import { holdingAdjustedStats, holdingQtyAtMk as stockQtyAtMk, holdingEarliestBuyMk } from './stockCalc.js'

export const DIVIDEND_TAX_RATE_PT = 0.28  // retenção padrão PT sobre dividendos

// ── Dividendos ────────────────────────────────────────────────
/**
 * Devolve todos os dividendos registados para o ano dado.
 * Inclui ações + ETFs. Cada entry:
 *   { source, ticker, name, date, amount, tax, gross, irs }
 * `tax` é o imposto registado pelo utilizador (opcional).
 * Se ausente, gross = amount / (1 − 0.28) e irs = gross − amount.
 */
export function collectDividends(data, year) {
  const rows = []

  function addFromHoldings(holdings, source) {
    for (const h of holdings || []) {
      for (const d of h.dividends || []) {
        const y = d.mk
          ? Number(d.mk.split('-')[0])
          : (d.date ? new Date(d.date).getFullYear() : null)
        if (y !== year) continue
        const amount = d.amount || 0
        const irs    = d.tax != null ? d.tax : Math.round(amount * (DIVIDEND_TAX_RATE_PT / (1 - DIVIDEND_TAX_RATE_PT)) * 100) / 100
        const gross  = amount + irs
        rows.push({
          source, ticker: h.ticker || '', name: h.name || h.ticker || '',
          date: d.date || d.mk || '', amount, irs, gross,
          taxIsEstimated: d.tax == null,
        })
      }
    }
  }

  addFromHoldings(data?.stocks?.acoes?.holdings, 'Ação')
  addFromHoldings(data?.stocks?.etfs?.holdings, 'ETF')

  return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

// ── Juros bancários (poupanças) ───────────────────────────────
/**
 * Agrega entradas de interestHistory de contas de poupança para o ano.
 * Cada entry: { platform, account, mk, month, gross, irs, net }
 */
export function collectBankInterest(data, year) {
  const rows = []

  for (const platform of data?.banks?.platforms || []) {
    for (const acc of platform.accounts || []) {
      if (acc.type === 'conta') continue
      for (const [mk, snap] of Object.entries(acc.monthData || {})) {
        const [mkYear] = mk.split('-').map(Number)
        if (mkYear !== year) continue
        for (const entry of snap.interestHistory || []) {
          rows.push({
            platform: platform.name || '',
            account:  acc.name      || '',
            mk,
            month:  entry.month || mk,
            gross:  entry.gross || 0,
            irs:    Math.round(((entry.gross || 0) - (entry.net || 0)) * 100) / 100,
            net:    entry.net   || 0,
          })
        }
      }
    }
  }

  return rows.sort((a, b) => a.mk.localeCompare(b.mk))
}

// ── Juros de Aforro ───────────────────────────────────────────
/**
 * Calcula juros líquidos e brutos de Certificados de Aforro para o ano.
 * Usa diferença de valor entre Dezembro do ano e Dezembro do ano anterior.
 * Certificados subscritos no próprio ano: diferença desde o montante inicial.
 */
export function collectAforroInterest(data, year) {
  const euribor = data?.aforro?.euribor || 0
  const rows = []

  for (const cert of data?.aforro?.certificates || []) {
    if (!cert.date) continue
    const certYear = new Date(cert.date).getFullYear()
    if (certYear > year) continue

    const endMk   = `${year}-11`      // Dezembro do ano alvo (mês 11 = Dez, 0-indexed)
    const startMk = `${year - 1}-11`  // Dezembro do ano anterior

    const netAtEnd   = calcAforroValueAt(cert, euribor, endMk)
    const netAtStart = certYear === year
      ? (cert.amount || 0)
      : calcAforroValueAt(cert, euribor, startMk)

    const netInterest   = Math.max(0, Math.round((netAtEnd - netAtStart) * 100) / 100)
    if (netInterest < 0.01) continue

    const grossInterest = Math.round((netInterest / (1 - AFORRO_IRS_RATE)) * 100) / 100
    const irsWithheld   = Math.round((grossInterest - netInterest) * 100) / 100

    rows.push({
      name:         cert.name || `Aforro ${cert.id || ''}`.trim(),
      subscribeDate: cert.date,
      amount:       cert.amount || 0,
      netInterest,
      grossInterest,
      irsWithheld,
    })
  }

  return rows
}

// ── Mais-valias — Ações & ETFs (PMP) ─────────────────────────
export const STOCK_CAP_GAIN_RATE = 0.28

/**
 * Devolve todas as mais-valias realizadas em ações/ETFs no ano dado.
 * Método: Preço Médio Ponderado (PMP) — regime PT.
 * Inclui sell lots parciais (isSell:true em h.lots) e vendas totais (h.sellMk).
 * Cada row: { type, ticker, name, date, qty, proceeds, cost, gain, irs, isFinalSell }
 */
export function collectStockCapitalGains(data, year) {
  const rows = []

  function processHolding(h, type) {
    const ticker = h.ticker || '—'
    const name   = h.name   || ''

    // Sell lots (vendas parciais) em year
    for (const lot of h.lots || []) {
      if (!lot.isSell || !lot.buyMk) continue
      if (parseInt(lot.buyMk.split('-')[0]) !== year) continue

      const cur = mkToNum(lot.buyMk)
      const buyLots       = (h.lots || []).filter(l => !l.isSell && (!l.buyMk || mkToNum(l.buyMk) <= cur))
      const totalBuyQty   = buyLots.reduce((s, l) => s + (l.qty   || 0), 0)
      const totalBuyGasto = buyLots.reduce((s, l) => s + (l.gasto || 0), 0)
      const avgCost = totalBuyQty > 0 ? totalBuyGasto / totalBuyQty : 0

      const soldQty = Math.abs(lot.qty || 0)
      const cost     = soldQty * avgCost
      const proceeds = lot.sellTotal || 0
      const gain     = proceeds - cost
      // Taxas dos lotes de compra repartidas proporcionalmente (informativo)
      const totalBuyTaxa = buyLots.reduce((s, l) => s + (l.taxa || 0), 0)
      const fees = totalBuyQty > 0 ? soldQty * (totalBuyTaxa / totalBuyQty) : 0

      rows.push({
        type, ticker, name,
        holdingId: h.id,
        date: lot.buyMk,
        firstBuyMk: holdingEarliestBuyMk(h),
        qty: Math.round(soldQty * 10000) / 10000,
        proceeds: Math.round(proceeds * 100) / 100,
        cost:     Math.round(cost    * 100) / 100,
        fees:     Math.round(fees    * 100) / 100,
        gain:     Math.round(gain    * 100) / 100,
        irs: gain > 0 ? Math.round(gain * STOCK_CAP_GAIN_RATE * 100) / 100 : 0,
        isFinalSell: false,
      })
    }

    // Venda total (h.sellMk) em year
    if (h.sellMk && parseInt(h.sellMk.split('-')[0]) === year) {
      const { adjustedGasto } = holdingAdjustedStats(h, h.sellMk)
      const remainingQty  = stockQtyAtMk(h, h.sellMk)
      const qty           = h.sellQty ?? Math.max(0, remainingQty)
      const finalProceeds = h.sellTotal != null
        ? h.sellTotal
        : (h.sellPrice ?? 0) * qty
      const gain = finalProceeds - adjustedGasto
      // Taxas: quota-parte proporcional à quantidade vendida (informativo)
      const allBuyLots   = (h.lots || []).filter(l => !l.isSell)
      const allBuyQty    = allBuyLots.reduce((s, l) => s + (l.qty  || 0), 0)
      const allBuyTaxa   = allBuyLots.reduce((s, l) => s + (l.taxa || 0), 0) + (h.taxaGasto || 0)
      const fees = allBuyQty > 0 ? qty * (allBuyTaxa / allBuyQty) : allBuyTaxa

      rows.push({
        type, ticker, name,
        holdingId: h.id,
        date: h.sellMk,
        firstBuyMk: holdingEarliestBuyMk(h),
        qty: Math.round(qty * 10000) / 10000,
        proceeds: Math.round(finalProceeds  * 100) / 100,
        cost:     Math.round(adjustedGasto  * 100) / 100,
        fees:     Math.round(fees           * 100) / 100,
        gain:     Math.round(gain           * 100) / 100,
        irs: gain > 0 ? Math.round(gain * STOCK_CAP_GAIN_RATE * 100) / 100 : 0,
        isFinalSell: true,
      })
    }
  }

  for (const h of data?.stocks?.acoes?.holdings || []) processHolding(h, 'Ação')
  for (const h of data?.stocks?.etfs?.holdings  || []) processHolding(h, 'ETF')

  return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

// ── Mais-valias — Crypto (FIFO, < 1 ano vs ≥ 1 ano) ──────────
/**
 * Devolve vendas de crypto registadas em h.salesHistory[] para o ano dado.
 * Cada row: { platform, ticker, date, qty, proceeds, cost, gain, taxableGain, exemptGain, taxDue }
 * Nota: vendas anteriores à implementação de salesHistory não aparecem aqui.
 */
export function collectCryptoCapitalGains(data, year) {
  const rows = []

  for (const platform of data?.crypto?.platforms || []) {
    for (const h of platform.holdings || []) {
      for (const sale of h.salesHistory || []) {
        if (!sale.date) continue
        if (new Date(sale.date).getFullYear() !== year) continue
        rows.push({
          platform:    platform.name  || '',
          ticker:      h.ticker       || '—',
          date:        sale.date,
          qty:         sale.sellQty   || 0,
          proceeds:    sale.proceeds  || 0,
          cost:        sale.cost      || 0,
          gain:        sale.gain      || 0,
          taxableGain: sale.taxableGain || 0,
          exemptGain:  sale.exemptGain  || 0,
          taxDue:      sale.taxDue      || 0,
        })
      }
    }
  }

  return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

// ── Totais consolidados ───────────────────────────────────────
export function irsYearSummary(data, year) {
  const dividends      = collectDividends(data, year)
  const bankInterest   = collectBankInterest(data, year)
  const aforroInterest = collectAforroInterest(data, year)
  const stockGains     = collectStockCapitalGains(data, year)
  const cryptoGains    = collectCryptoCapitalGains(data, year)

  return {
    dividends: {
      rows:       dividends,
      totalGross: dividends.reduce((s, r) => s + r.gross,  0),
      totalIRS:   dividends.reduce((s, r) => s + r.irs,    0),
      totalNet:   dividends.reduce((s, r) => s + r.amount, 0),
    },
    bankInterest: {
      rows:       bankInterest,
      totalGross: bankInterest.reduce((s, r) => s + r.gross, 0),
      totalIRS:   bankInterest.reduce((s, r) => s + r.irs,   0),
      totalNet:   bankInterest.reduce((s, r) => s + r.net,   0),
    },
    aforroInterest: {
      rows:       aforroInterest,
      totalGross: aforroInterest.reduce((s, r) => s + r.grossInterest, 0),
      totalIRS:   aforroInterest.reduce((s, r) => s + r.irsWithheld,  0),
      totalNet:   aforroInterest.reduce((s, r) => s + r.netInterest,  0),
    },
    stockGains: {
      rows:          stockGains,
      totalProceeds: stockGains.reduce((s, r) => s + r.proceeds, 0),
      totalCost:     stockGains.reduce((s, r) => s + r.cost,     0),
      totalGain:     stockGains.reduce((s, r) => s + r.gain,     0),
      totalIRS:      stockGains.reduce((s, r) => s + r.irs,      0),
    },
    cryptoGains: {
      rows:             cryptoGains,
      totalProceeds:    cryptoGains.reduce((s, r) => s + r.proceeds,    0),
      totalCost:        cryptoGains.reduce((s, r) => s + r.cost,        0),
      totalGain:        cryptoGains.reduce((s, r) => s + r.gain,        0),
      totalTaxableGain: cryptoGains.reduce((s, r) => s + r.taxableGain, 0),
      totalExemptGain:  cryptoGains.reduce((s, r) => s + r.exemptGain,  0),
      totalIRS:         cryptoGains.reduce((s, r) => s + r.taxDue,      0),
    },
  }
}

// ── CSV export ────────────────────────────────────────────────
function toCsvRow(row) {
  return row.map(cell => {
    const s = String(cell ?? '')
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')
}

export function exportIRSCSV(data, year) {
  const { dividends, bankInterest, aforroInterest, stockGains, cryptoGains } = irsYearSummary(data, year)
  const lines = [`IRS ${year} — Relatório`, '']

  if (dividends.rows.length) {
    lines.push('DIVIDENDOS')
    lines.push(toCsvRow(['Tipo', 'Ticker', 'Nome', 'Data', 'Bruto (€)', 'IRS (€)', 'Líquido (€)', 'IRS estimado']))
    for (const r of dividends.rows) {
      lines.push(toCsvRow([r.source, r.ticker, r.name, r.date, r.gross.toFixed(2), r.irs.toFixed(2), r.amount.toFixed(2), r.taxIsEstimated ? 'Sim' : 'Não']))
    }
    lines.push(toCsvRow(['', '', '', 'TOTAL', dividends.totalGross.toFixed(2), dividends.totalIRS.toFixed(2), dividends.totalNet.toFixed(2), '']))
    lines.push('')
  }

  if (bankInterest.rows.length) {
    lines.push('JUROS BANCÁRIOS (POUPANÇA)')
    lines.push(toCsvRow(['Plataforma', 'Conta', 'Período', 'Bruto (€)', 'IRS (€)', 'Líquido (€)']))
    for (const r of bankInterest.rows) {
      lines.push(toCsvRow([r.platform, r.account, r.month, r.gross.toFixed(2), r.irs.toFixed(2), r.net.toFixed(2)]))
    }
    lines.push(toCsvRow(['', '', 'TOTAL', bankInterest.totalGross.toFixed(2), bankInterest.totalIRS.toFixed(2), bankInterest.totalNet.toFixed(2)]))
    lines.push('')
  }

  if (aforroInterest.rows.length) {
    lines.push('JUROS CERTIFICADOS DE AFORRO')
    lines.push(toCsvRow(['Nome', 'Data Subscrição', 'Montante (€)', 'Bruto (€)', 'IRS 28% (€)', 'Líquido (€)']))
    for (const r of aforroInterest.rows) {
      lines.push(toCsvRow([r.name, r.subscribeDate, r.amount.toFixed(2), r.grossInterest.toFixed(2), r.irsWithheld.toFixed(2), r.netInterest.toFixed(2)]))
    }
    lines.push(toCsvRow(['', '', 'TOTAL', aforroInterest.totalGross.toFixed(2), aforroInterest.totalIRS.toFixed(2), aforroInterest.totalNet.toFixed(2)]))
    lines.push('')
  }

  if (stockGains.rows.length) {
    lines.push('MAIS-VALIAS — AÇÕES & ETFs (Cat. G)')
    lines.push(toCsvRow(['Tipo', 'Ticker', 'Nome', 'Mês', 'Qtd', 'Recebido (€)', 'Custo PMP (€)', 'Ganho (€)', 'IRS 28% (€)', 'Venda total']))
    for (const r of stockGains.rows) {
      lines.push(toCsvRow([r.type, r.ticker, r.name, r.date, r.qty, r.proceeds.toFixed(2), r.cost.toFixed(2), r.gain.toFixed(2), r.irs.toFixed(2), r.isFinalSell ? 'Sim' : 'Não']))
    }
    lines.push(toCsvRow(['', '', '', '', 'TOTAL', stockGains.totalProceeds.toFixed(2), stockGains.totalCost.toFixed(2), stockGains.totalGain.toFixed(2), stockGains.totalIRS.toFixed(2), '']))
    lines.push('')
  }

  if (cryptoGains.rows.length) {
    lines.push('MAIS-VALIAS — CRYPTO (Cat. G)')
    lines.push(toCsvRow(['Plataforma', 'Ticker', 'Data', 'Qtd', 'Recebido (€)', 'Custo FIFO (€)', 'Ganho total (€)', 'Ganho tributável (€)', 'Ganho isento (€)', 'IRS 28% (€)']))
    for (const r of cryptoGains.rows) {
      lines.push(toCsvRow([r.platform, r.ticker, r.date, r.qty, r.proceeds.toFixed(2), r.cost.toFixed(2), r.gain.toFixed(2), r.taxableGain.toFixed(2), r.exemptGain.toFixed(2), r.taxDue.toFixed(2)]))
    }
    lines.push(toCsvRow(['', '', '', 'TOTAL', cryptoGains.totalProceeds.toFixed(2), cryptoGains.totalCost.toFixed(2), cryptoGains.totalGain.toFixed(2), cryptoGains.totalTaxableGain.toFixed(2), cryptoGains.totalExemptGain.toFixed(2), cryptoGains.totalIRS.toFixed(2)]))
  }

  return lines.join('\r\n')
}
