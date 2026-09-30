// ── Export Excel para o IRS (Anexo G — vendas de ações/ETFs) ───────
// Gera um .xlsx com o HISTÓRICO COMPLETO (todos os anos com vendas),
// pensado para ser aberto daqui a muitos anos: cada venda com valor de
// realização, aquisição, taxas, mais-valia e IRS estimado, mais os
// dividendos e um resumo anual. `buildIrsExcelData` é puro (testável);
// `exportIrsExcelBase64` embrulha-o em xlsx (import dinâmico).

import { MONTHS_SHORT } from '../data/initialData.js'
import { collectStockCapitalGains, collectDividends, STOCK_CAP_GAIN_RATE } from './calc/irsCalc.js'

const r2 = v => Math.round((v || 0) * 100) / 100

function mkLabel(mk) {
  if (!mk) return '—'
  const [y, m] = String(mk).split('-').map(Number)
  return `${MONTHS_SHORT[m] || '?'} ${y}`
}

// Anos com vendas ou dividendos registados (ordenados)
export function irsYearsWithActivity(data) {
  const years = new Set()
  const scan = (holdings) => {
    for (const h of holdings || []) {
      if (h.sellMk) years.add(Number(h.sellMk.split('-')[0]))
      for (const l of h.lots || []) if (l.isSell && l.buyMk) years.add(Number(l.buyMk.split('-')[0]))
      for (const d of h.dividends || []) {
        if (d.mk) years.add(Number(d.mk.split('-')[0]))
        else if (d.date) years.add(new Date(d.date).getFullYear())
      }
    }
  }
  scan(data?.stocks?.acoes?.holdings)
  scan(data?.stocks?.etfs?.holdings)
  return [...years].filter(y => !isNaN(y)).sort((a, b) => a - b)
}

// Constrói as matrizes (AOA) das quatro folhas. Puro.
export function buildIrsExcelData(data, { now = new Date() } = {}) {
  const years = irsYearsWithActivity(data)

  // ── Folha "Vendas" — uma linha por realização, todos os anos ──
  const vendas = [[
    'Ano venda', 'Mês venda', 'Tipo', 'Ticker', 'Nome', 'Qtd vendida',
    'Valor de realização (€)', 'Valor de aquisição (€)', 'Taxas registadas (€)',
    'Mais/menos-valia (€)', `IRS estimado ${(STOCK_CAP_GAIN_RATE * 100).toFixed(0)}% (€)`,
    'Líquido (€)', '1.ª aquisição', 'Venda',
  ]]
  const resumoPorAno = []
  for (const y of years) {
    const rows = collectStockCapitalGains(data, y)
    let tProceeds = 0, tCost = 0, tGain = 0, tIrs = 0
    for (const r of rows) {
      const [, m] = String(r.date).split('-').map(Number)
      vendas.push([
        y, MONTHS_SHORT[m] || '?', r.type, r.ticker, r.name, r.qty,
        r2(r.proceeds), r2(r.cost), r2(r.fees),
        r2(r.gain), r2(r.irs), r2(r.gain - r.irs),
        mkLabel(r.firstBuyMk), r.isFinalSell ? 'Total' : 'Parcial',
      ])
      tProceeds += r.proceeds; tCost += r.cost; tGain += r.gain; tIrs += r.irs
    }
    if (rows.length) {
      resumoPorAno.push({ y, n: rows.length, tProceeds, tCost, tGain, tIrs })
    }
  }

  // ── Folha "Dividendos" ──
  const dividendos = [[
    'Ano', 'Data / Mês', 'Origem', 'Ticker', 'Nome',
    'Bruto (€)', 'IRS retido (€)', 'Líquido (€)', 'Retenção estimada?',
  ]]
  for (const y of years) {
    for (const d of collectDividends(data, y)) {
      dividendos.push([
        y, d.date || '', d.source, d.ticker, d.name,
        r2(d.gross), r2(d.irs), r2(d.amount), d.taxIsEstimated ? 'Sim' : 'Não',
      ])
    }
  }

  // ── Folha "Resumo" — totais por ano + total global ──
  const resumo = [[
    'Ano', 'N.º vendas', 'Total realização (€)', 'Total aquisição (€)',
    'Mais/menos-valia (€)', `IRS estimado ${(STOCK_CAP_GAIN_RATE * 100).toFixed(0)}% (€)`, 'Líquido (€)',
  ]]
  let gProceeds = 0, gCost = 0, gGain = 0, gIrs = 0
  for (const s of resumoPorAno) {
    resumo.push([s.y, s.n, r2(s.tProceeds), r2(s.tCost), r2(s.tGain), r2(s.tIrs), r2(s.tGain - s.tIrs)])
    gProceeds += s.tProceeds; gCost += s.tCost; gGain += s.tGain; gIrs += s.tIrs
  }
  resumo.push(['TOTAL', resumoPorAno.reduce((s, x) => s + x.n, 0), r2(gProceeds), r2(gCost), r2(gGain), r2(gIrs), r2(gGain - gIrs)])

  // ── Folha "Notas" ──
  const notas = [
    ['Thrive Finance — apoio ao preenchimento do IRS (Anexo G)'],
    [`Gerado a ${now.toLocaleDateString('pt-PT')} · documento informativo, não substitui aconselhamento fiscal`],
    [''],
    ['Como usar no Anexo G (quadro 9 — alienação onerosa de partes sociais):'],
    ['· "Valor de realização" → campo Realização (com o ano/mês da venda).'],
    ['· "Valor de aquisição" → campo Aquisição. Método usado: PMP (preço médio ponderado).'],
    ['· "Taxas registadas" → campo Despesas e encargos (se não estiverem já incluídas no valor de aquisição — confere como registaste as compras).'],
    ['· "1.ª aquisição" indica o mês do primeiro lote; com múltiplos lotes a AT pode esperar desagregação FIFO — confirma com o teu contabilista.'],
    [''],
    [`Taxa autónoma em vigor à data de geração: ${(STOCK_CAP_GAIN_RATE * 100).toFixed(0)}%. Podes optar pelo englobamento (ver simulador na app).`],
    ['Desde 2023: ganhos de ativos detidos <365 dias são englobados obrigatoriamente se o rendimento coletável estiver no último escalão.'],
    ['Menos-valias são reportáveis até 5 anos apenas optando pelo englobamento.'],
    [''],
    ['Dividendos: folha própria — declarados na Cat. E (Anexo E, ou Anexo J se de fonte estrangeira).'],
    ['Retenção "estimada" = sem imposto registado na app; assumiu-se 28%.'],
  ]

  return { resumo, vendas, dividendos, notas, years }
}

// Gera o .xlsx e devolve em base64 (para gravação binária via IPC).
export async function exportIrsExcelBase64(data) {
  const XLSX = await import('xlsx')
  const { resumo, vendas, dividendos, notas } = buildIrsExcelData(data)
  const wb = XLSX.utils.book_new()

  const addSheet = (name, aoa, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    if (widths) ws['!cols'] = widths.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  addSheet('Resumo',     resumo,     [8, 10, 20, 20, 20, 20, 14])
  addSheet('Vendas',     vendas,     [9, 9, 7, 10, 26, 11, 20, 20, 17, 18, 18, 12, 13, 9])
  addSheet('Dividendos', dividendos, [6, 12, 10, 10, 26, 12, 13, 12, 16])
  addSheet('Notas',      notas,      [130])

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}
