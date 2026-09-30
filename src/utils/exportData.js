import { MONTHS_SHORT } from '../data/initialData.js'

// ── CSV helpers ───────────────────────────────────────────────
function toCSV(rows) {
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(',')
  ).join('\r\n')
}

function fmt(n) {
  return typeof n === 'number' ? n.toFixed(2) : ''
}

// ── Holdings CSV (Ações + ETFs + Crypto) ──────────────────────
// Exporta todas as posições (ativas e vendidas) com custo médio calculado.
export function exportHoldingsCSV(data) {
  const rows = [
    ['Tipo', 'Ticker', 'Nome/Plataforma', 'Estado', 'Primeiro Lote', 'Qtd', 'Custo Médio (€)', 'Preço Venda (€)', 'Dividendos (€)'],
  ]

  function addStockRows(holdings, type) {
    for (const h of holdings || []) {
      const lots     = h.lots || []
      const qty      = lots.reduce((s, l) => s + (l.qty || 0), 0)
      const spent    = lots.reduce((s, l) => s + (l.qty || 0) * (l.pricePerShare || 0), 0)
      const avgCost  = qty > 0 ? spent / qty : 0
      const firstMk  = lots.map(l => l.buyMk).filter(Boolean).sort()[0] || ''
      const divTotal = (h.dividends || []).reduce((s, d) => s + (d.amount || 0), 0)
      rows.push([
        type, h.ticker || '', h.name || '',
        h.sellMk ? 'Vendida' : 'Ativa',
        firstMk,
        fmt(qty),
        fmt(avgCost),
        h.sellMk ? fmt(h.sellPrice || 0) : '',
        fmt(divTotal),
      ])
    }
  }

  addStockRows(data?.stocks?.acoes?.holdings, 'Ação')
  addStockRows(data?.stocks?.etfs?.holdings, 'ETF')

  for (const platform of data?.crypto?.platforms || []) {
    for (const h of platform.holdings || []) {
      const lots    = h.lots || []
      const qty     = lots.reduce((s, l) => s + (l.qty || 0), 0)
      const spent   = lots.reduce((s, l) => s + (l.qty || 0) * (l.priceEUR || 0), 0)
      const avgCost = qty > 0 ? spent / qty : 0
      const firstD  = lots.map(l => l.buyDate).filter(Boolean).sort()[0] || ''
      rows.push([
        'Crypto', h.ticker || '', platform.name || '',
        qty > 0 ? 'Ativa' : 'Esgotada',
        firstD,
        fmt(qty),
        fmt(avgCost),
        '', '',
      ])
    }
  }

  return toCSV(rows)
}

// ── Annual Summary CSV ────────────────────────────────────────
// Instantâneos mensais gravados (não recalcula ao vivo).
export function exportAnnualSummaryCSV(data) {
  const rows = [
    ['Ano', 'Mês', 'Banco (€)', 'Poupança (€)', 'Ações (€)', 'ETFs (€)', 'PPR (€)', 'Aforro (€)', 'Crypto (€)', 'Total (€)'],
  ]

  for (const [yearStr, yearData] of Object.entries(data?.years || {}).sort()) {
    const year = Number(yearStr)
    for (let m = 0; m < 12; m++) {
      const snap = yearData.months?.[m]
      if (!snap) continue
      const total =
        (snap.banco || 0) + (snap.poupanca || 0) + (snap.acoes || 0) +
        (snap.etfs  || 0) + (snap.ppr     || 0) + (snap.aforro || 0) + (snap.crypto || 0)
      rows.push([
        year, MONTHS_SHORT[m],
        fmt(snap.banco    || 0), fmt(snap.poupanca || 0),
        fmt(snap.acoes    || 0), fmt(snap.etfs     || 0),
        fmt(snap.ppr      || 0), fmt(snap.aforro   || 0),
        fmt(snap.crypto   || 0), fmt(total),
      ])
    }
  }

  return toCSV(rows)
}

// ── Full JSON export ──────────────────────────────────────────
// Adiciona metadados de exportação; compatível com o import validado.
export function exportFullJSON(data) {
  const payload = {
    _exportedAt: new Date().toISOString(),
    _exportVersion: 1,
    ...data,
  }
  return JSON.stringify(payload, null, 2)
}

// ── Trigger download in browser (fallback for non-Electron) ──
export function triggerDownload(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
