import { describe, it, expect } from 'vitest'
import { buildIrsExcelData, irsYearsWithActivity, exportIrsExcelBase64 } from '../exportIrsExcel.js'

const data = {
  currentYear: 2026, currentMonth: 6,
  stocks: {
    acoes: { holdings: [
      // Venda total em 2026: comprada 2024 por 1000+10 taxa, vendida por 1400
      { id: 'h1', ticker: 'AAPL', name: 'Apple',
        lots: [{ id: 'l1', buyMk: '2024-2', qty: 10, gasto: 1000, taxa: 10 }],
        sellMk: '2026-1', sellTotal: 1400, sellQty: 10, sellPrice: 140,
        dividends: [{ id: 'd1', mk: '2025-3', amount: 36 }] },
      // Venda parcial em 2025: 5 de 10 unidades a custo médio 100 → recebido 650
      { id: 'h2', ticker: 'VWCE', name: 'Vanguard All-World',
        lots: [
          { id: 'l2', buyMk: '2024-0', qty: 10, gasto: 1000 },
          { id: 'l3', buyMk: '2025-5', qty: -5, isSell: true, sellTotal: 650 },
        ] },
      // Posição activa sem vendas — não deve aparecer nas vendas
      { id: 'h3', ticker: 'NKE', name: 'Nike', lots: [{ id: 'l4', buyMk: '2026-0', qty: 5, gasto: 400 }] },
    ] },
    etfs: { holdings: [] },
  },
}

describe('irsYearsWithActivity', () => {
  it('anos com vendas ou dividendos, ordenados', () => {
    expect(irsYearsWithActivity(data)).toEqual([2025, 2026])
  })
  it('vazio sem atividade', () => {
    expect(irsYearsWithActivity({ stocks: { acoes: { holdings: [] }, etfs: { holdings: [] } } })).toEqual([])
  })
})

describe('buildIrsExcelData', () => {
  const { resumo, vendas, dividendos, notas } = buildIrsExcelData(data, { now: new Date(2026, 6, 7) })

  it('folha Vendas: uma linha por realização, com valores certos', () => {
    expect(vendas).toHaveLength(3) // header + 2 vendas
    const parcial = vendas.find(r => r[3] === 'VWCE')
    expect(parcial[0]).toBe(2025)
    expect(parcial[6]).toBe(650)   // realização
    expect(parcial[7]).toBe(500)   // aquisição (5 × 100 PMP)
    expect(parcial[9]).toBe(150)   // mais-valia
    expect(parcial[10]).toBeCloseTo(42, 2) // IRS 28%
    const total = vendas.find(r => r[3] === 'AAPL')
    expect(total[0]).toBe(2026)
    expect(total[9]).toBe(400)  // 1400 − 1000 (taxa vai na coluna própria, como no Anexo G)
    expect(total[8]).toBe(10)   // taxas registadas — coluna "Despesas e encargos"
    expect(total[13]).toBe('Total')
  })

  it('folha Resumo: totais por ano + TOTAL global', () => {
    expect(resumo.at(-1)[0]).toBe('TOTAL')
    const anos = resumo.slice(1, -1).map(r => r[0])
    expect(anos).toEqual([2025, 2026])
  })

  it('folha Dividendos inclui o dividendo de 2025', () => {
    expect(dividendos.length).toBeGreaterThan(1)
    expect(dividendos.some(r => r[3] === 'AAPL')).toBe(true)
  })

  it('folha Notas menciona o Anexo G e o método PMP', () => {
    const texto = notas.flat().join(' ')
    expect(texto).toContain('Anexo G')
    expect(texto).toContain('PMP')
  })
})

describe('exportIrsExcelBase64', () => {
  it('gera um .xlsx válido (assinatura ZIP em base64)', async () => {
    const b64 = await exportIrsExcelBase64(data)
    expect(typeof b64).toBe('string')
    // 'UEsDB' = "PK\x03\x04" — assinatura de um ficheiro zip/xlsx
    expect(b64.startsWith('UEsDB')).toBe(true)
    expect(b64.length).toBeGreaterThan(1000)
  })
})
