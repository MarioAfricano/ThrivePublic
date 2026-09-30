// ── Import de extratos XTB (.xlsx) ─────────────────────────────────
// Suporta os dois formatos que a XTB exporta:
//   A) Zip anual — folhas "Cash Operations" e "Closed Positions"
//      (cabeçalhos na linha 5, colunas nomeadas, datas em serial Excel)
//   B) Statement mensal — "CASH OPERATION HISTORY", "CLOSED POSITION
//      HISTORY", … (preâmbulo maior, mesmas colunas com outros nomes)
// O parser é dirigido pelos NOMES das colunas, não pelas posições —
// aguenta variações de layout. Tudo puro: recebe { nomeFolha: aoa }.
//
// Dedupe: cada lote/dividendo importado ganha um `srcId` estável;
// reimportar o mesmo ficheiro (ou ficheiros sobrepostos, ex.: mensal +
// anual) não duplica nada.

import { generateId } from './id.js'

const DAY_MS = 86400000

// Serial Excel (dias desde 1900) → Date UTC
export function serialToDate(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return null
  return new Date(Math.round((serial - 25569) * DAY_MS))
}
export function serialToMk(serial) {
  const d = serialToDate(serial)
  return d ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : null
}
const dayKey = (serial) => {
  const d = serialToDate(serial)
  return d ? d.toISOString().slice(0, 10) : null
}

// Moeda inferida do sufixo do ticker XTB (.US → USD; europeus → EUR)
export function xtbCurrency(ticker) {
  const t = String(ticker || '').toUpperCase()
  if (/\.(US)$/.test(t)) return 'USD'
  if (/\.(UK|L)$/.test(t)) return 'GBP'
  return 'EUR'
}

// Encontra uma folha cujo nome corresponda ao padrão
function findSheet(sheets, re) {
  const name = Object.keys(sheets || {}).find(n => re.test(n))
  return name ? sheets[name] : null
}

// Localiza a linha de cabeçalho (contém todos os `required`) e devolve
// um mapa nomeNormalizado → índice de coluna.
function findHeader(aoa, required) {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = (aoa[i] || []).map(c => String(c ?? '').trim().toLowerCase())
    if (required.every(req => row.some(c => c === req || c.startsWith(req)))) {
      const map = {}
      row.forEach((c, idx) => { if (c) map[c] = idx })
      return { map, headerRow: i }
    }
  }
  return null
}
const col = (map, ...names) => {
  for (const n of names) {
    if (map[n] != null) return map[n]
    const k = Object.keys(map).find(c => c.startsWith(n))
    if (k) return map[k]
  }
  return null
}

/**
 * Extrai compras, vendas e dividendos das folhas de um extrato XTB.
 * @param sheets  { nomeFolha: aoa (array de arrays) }
 * @returns { buys, sells, dividends, warnings }
 */
export function parseXtb(sheets) {
  const warnings = []
  const buys = [], sells = [], dividends = []

  // ── Cash operations (compras, dividendos, retenções) ──
  const cash = findSheet(sheets, /cash operation/i)
  if (cash) {
    const h = findHeader(cash, ['type', 'amount'])
    if (!h) warnings.push('Folha de operações de caixa sem cabeçalho reconhecível.')
    else {
      const cType = col(h.map, 'type'), cAmount = col(h.map, 'amount')
      const cTicker = col(h.map, 'ticker', 'symbol'), cName = col(h.map, 'instrument')
      const cTime = col(h.map, 'time'), cId = col(h.map, 'id')
      const cComment = col(h.map, 'comment')
      const rawDivs = [], rawWht = []
      for (const row of cash.slice(h.headerRow + 1)) {
        const type = String(row?.[cType] ?? '').toLowerCase()
        if (!type) continue
        const ticker = String(row[cTicker] ?? '').trim().toUpperCase()
        const time = row[cTime], amount = Number(row[cAmount])
        const comment = String(row[cComment] ?? '')
        const id = row[cId]
        if (/stock.*purchase/.test(type)) {
          // "OPEN BUY 0.6542 @ 160.54" ou execução parcial "OPEN BUY 3/3.2736 @ 137.23"
          const m = comment.match(/OPEN BUY ([\d.]+)(?:\/[\d.]+)? @ ([\d.]+)/i)
          if (!m || !ticker || !isFinite(amount)) { warnings.push(`Compra ilegível: "${comment}"`); continue }
          buys.push({
            ticker, name: cName != null ? String(row[cName] ?? '').trim() : '',
            qty: parseFloat(m[1]), price: parseFloat(m[2]),
            gasto: Math.abs(amount), mk: serialToMk(time), date: dayKey(time),
            srcId: id != null ? `xtb-${id}` : `xtb-${ticker}-${dayKey(time)}-${amount}`,
          })
        } else if (/stock.*sale/.test(type)) {
          const m = comment.match(/CLOSE BUY ([\d.]+)(?:\/[\d.]+)? @ ([\d.]+)/i)
          sells.push({
            ticker, qty: m ? parseFloat(m[1]) : null, closePrice: m ? parseFloat(m[2]) : null,
            saleValue: Math.abs(amount), mk: serialToMk(time),
            srcId: id != null ? `xtb-${id}` : `xtb-sale-${ticker}-${dayKey(time)}-${amount}`,
            fromCashOps: true,
          })
        } else if (/^divid/.test(type)) {
          rawDivs.push({ ticker, amount, time, name: cName != null ? String(row[cName] ?? '').trim() : '' })
        } else if (/withholding/.test(type)) {
          rawWht.push({ ticker, amount, time })
        }
      }
      // Agrega dividendos por ticker+dia (a XTB parte em várias linhas) e
      // abate a retenção na fonte do mesmo dia: amount = líquido, tax = WHT.
      const groups = new Map()
      for (const d of rawDivs) {
        const key = `${d.ticker}|${dayKey(d.time)}`
        const g = groups.get(key) || { ticker: d.ticker, name: d.name, time: d.time, gross: 0, wht: 0 }
        g.gross += d.amount
        if (!g.name && d.name) g.name = d.name
        groups.set(key, g)
      }
      for (const w of rawWht) {
        const key = `${w.ticker}|${dayKey(w.time)}`
        const g = groups.get(key)
        if (g) g.wht += Math.abs(w.amount)
        else warnings.push(`Retenção sem dividendo correspondente: ${w.ticker} ${dayKey(w.time)}`)
      }
      for (const [key, g] of groups) {
        dividends.push({
          ticker: g.ticker, name: g.name,
          amount: Math.round((g.gross - g.wht) * 100) / 100,   // líquido
          tax: Math.round(g.wht * 100) / 100 || undefined,
          mk: serialToMk(g.time), date: dayKey(g.time),
          srcId: `xtbdiv-${key}`,
        })
      }
    }
  }

  // ── Closed positions (vendas, com valores exatos por lote) ──
  const closed = findSheet(sheets, /closed position/i)
  if (closed) {
    const h = findHeader(closed, ['volume', 'sale value'])
    if (h) {
      const cTicker = col(h.map, 'ticker', 'symbol'), cVol = col(h.map, 'volume')
      const cClosePrice = col(h.map, 'close price'), cCloseTime = col(h.map, 'close time')
      const cSale = col(h.map, 'sale value'), cCat = col(h.map, 'category')
      const cName = col(h.map, 'instrument')
      const fromClosed = []
      for (const row of closed.slice(h.headerRow + 1)) {
        const ticker = String(row?.[cTicker] ?? '').trim().toUpperCase()
        const vol = Number(row?.[cVol]), sale = Number(row?.[cSale])
        if (!ticker || !isFinite(vol) || vol <= 0 || !isFinite(sale)) continue
        fromClosed.push({
          ticker, qty: vol,
          closePrice: Number(row[cClosePrice]) || null,
          saleValue: sale, mk: serialToMk(row[cCloseTime]),
          category: cCat != null ? String(row[cCat] ?? '').trim() : '',
          name: cName != null ? String(row[cName] ?? '').trim() : '',
          srcId: `xtbclose-${ticker}-${dayKey(row[cCloseTime])}-${vol}-${sale}`,
        })
      }
      if (fromClosed.length) {
        // Preferir closed positions (valores exatos); descartar as vendas
        // equivalentes vindas do cash ops para não duplicar.
        const cashSales = sells.splice(0, sells.length).filter(s => !s.fromCashOps)
        sells.push(...cashSales, ...fromClosed)
      }
    }
  }

  return { buys, sells, dividends, warnings }
}

// ── Plano de importação ────────────────────────────────────────────
// Agrupa por ticker, cruza com as holdings existentes e sugere a
// categoria para tickers novos (Category da XTB ou heurística do nome).
// Todos os srcId já presentes nos dados (lotes + dividendos) — a
// preview da Inbox usa isto para assinalar operações já importadas.
export function collectSrcIds(data) {
  const ids = new Set()
  for (const cat of ['acoes', 'etfs']) {
    for (const h of data?.stocks?.[cat]?.holdings || []) {
      for (const l of h.lots || []) if (l.srcId) ids.add(l.srcId)
      for (const d of h.dividends || []) if (d.srcId) ids.add(d.srcId)
    }
  }
  return ids
}

export function buildXtbPlan(data, parsed) {
  const findExisting = (ticker) => {
    for (const kind of ['acoes', 'etfs']) {
      const hit = (data?.stocks?.[kind]?.holdings || []).find(
        h => (h.ticker || '').toUpperCase() === ticker)
      if (hit) return { kind, holding: hit }
    }
    return null
  }
  const tickers = new Map()
  const touch = (t) => {
    if (!tickers.has(t)) tickers.set(t, { ticker: t, name: '', buys: [], sells: [], dividends: [] })
    return tickers.get(t)
  }
  for (const b of parsed.buys)      { const g = touch(b.ticker); g.buys.push(b); if (b.name) g.name = g.name || b.name }
  for (const s of parsed.sells)     { const g = touch(s.ticker); g.sells.push(s); if (s.name) g.name = g.name || s.name }
  for (const d of parsed.dividends) { const g = touch(d.ticker); g.dividends.push(d); if (d.name) g.name = g.name || d.name }

  const rows = []
  for (const g of tickers.values()) {
    const existing = findExisting(g.ticker)
    const xtbCat = g.sells.find(s => s.category)?.category || ''
    const suggested = existing ? existing.kind
      : /etf/i.test(xtbCat) || /all-world|s&p|msci|ftse|etf/i.test(g.name) ? 'etfs' : 'acoes'
    rows.push({
      ticker: g.ticker, name: g.name,
      isNew: !existing, category: suggested,
      nBuys: g.buys.length, nSells: g.sells.length, nDivs: g.dividends.length,
      totalGasto: Math.round(g.buys.reduce((s, b) => s + b.gasto, 0) * 100) / 100,
      totalDivs:  Math.round(g.dividends.reduce((s, d) => s + d.amount, 0) * 100) / 100,
    })
  }
  return rows.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

// ── Aplicar (com dedupe por srcId) ─────────────────────────────────
// `categoryByTicker`: { TICKER: 'acoes'|'etfs' } — só usado para novos.
export function applyXtbImport(data, parsed, categoryByTicker = {}) {
  const stocks = data?.stocks || {}
  const lists = {
    acoes: [...(stocks.acoes?.holdings || [])],
    etfs:  [...(stocks.etfs?.holdings  || [])],
  }
  const counts = { buys: 0, sells: 0, dividends: 0, newHoldings: 0, skipped: 0 }

  const locate = (ticker) => {
    for (const kind of ['acoes', 'etfs']) {
      const idx = lists[kind].findIndex(h => (h.ticker || '').toUpperCase() === ticker)
      if (idx >= 0) return { kind, idx }
    }
    return null
  }
  const ensureHolding = (ticker, name) => {
    let loc = locate(ticker)
    if (loc) return loc
    const kind = categoryByTicker[ticker] === 'acoes' ? 'acoes'
      : categoryByTicker[ticker] === 'etfs' ? 'etfs' : 'acoes'
    lists[kind].push({
      id: generateId(), ticker, name: name || ticker,
      platform: 'XTB', currency: xtbCurrency(ticker),
      price: 0, lots: [], dividends: [], monthData: {},
    })
    counts.newHoldings++
    return { kind, idx: lists[kind].length - 1 }
  }
  const mut = (loc, fn) => {
    const h = lists[loc.kind][loc.idx]
    lists[loc.kind][loc.idx] = fn({ ...h, lots: [...(h.lots || [])], dividends: [...(h.dividends || [])] })
  }
  const hasSrc = (arr, srcId) => arr.some(x => x.srcId === srcId)

  for (const b of parsed.buys) {
    const loc = ensureHolding(b.ticker, b.name)
    mut(loc, h => {
      if (hasSrc(h.lots, b.srcId)) { counts.skipped++; return h }
      h.lots.push({ id: generateId(), srcId: b.srcId, buyMk: b.mk, qty: b.qty, price: b.price, gasto: b.gasto })
      counts.buys++
      if (!h.price) { h.price = b.price; h.priceUpdatedAt = undefined }
      return h
    })
  }
  for (const s of parsed.sells) {
    const loc = ensureHolding(s.ticker, s.name)
    mut(loc, h => {
      if (hasSrc(h.lots, s.srcId)) { counts.skipped++; return h }
      h.lots.push({
        id: generateId(), srcId: s.srcId, buyMk: s.mk, qty: -(s.qty || 0),
        isSell: true, sellTotal: s.saleValue, sellPrice: s.closePrice ?? undefined,
      })
      counts.sells++
      return h
    })
  }
  for (const d of parsed.dividends) {
    const loc = ensureHolding(d.ticker, d.name)
    mut(loc, h => {
      if (hasSrc(h.dividends, d.srcId)) { counts.skipped++; return h }
      h.dividends.push({ id: generateId(), srcId: d.srcId, mk: d.mk, date: d.date, amount: d.amount, ...(d.tax ? { tax: d.tax } : {}) })
      counts.dividends++
      return h
    })
  }

  return {
    patch: {
      stocks: {
        ...stocks,
        acoes: { ...(stocks.acoes || {}), holdings: lists.acoes },
        etfs:  { ...(stocks.etfs  || {}), holdings: lists.etfs },
      },
    },
    counts,
  }
}
