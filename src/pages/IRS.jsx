import { useState, useMemo } from 'react'
import { Download, Info, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import Button from '../components/ui/Button.jsx'
import { formatEuro } from '../data/initialData.js'
import { irsYearSummary, exportIRSCSV } from '../utils/calc/irsCalc.js'
import { exportIrsExcelBase64 } from '../utils/exportIrsExcel.js'
import { triggerDownload } from '../utils/exportData.js'
import EnglobamentoCard from '../components/irs/EnglobamentoCard.jsx'

const isElectron = typeof window !== 'undefined' && !!window.api

async function saveCSV(content, filename) {
  if (isElectron) {
    await window.api.showSaveDialog({ defaultPath: filename, content, filters: [{ name: 'CSV', extensions: ['csv'] }] })
  } else {
    triggerDownload(content, filename, 'text/csv;charset=utf-8;')
  }
}

// ── UI helpers ────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</p>}
    </div>
  )
}

const TH = ({ children, right }) => (
  <th style={{ padding: '6px 10px 6px 0', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>
    {children}
  </th>
)
const TD = ({ children, right, muted, red, green }) => (
  <td style={{ padding: '7px 10px 7px 0', fontSize: '0.8rem', color: red ? 'var(--red)' : green ? 'var(--green)' : muted ? 'var(--text-muted)' : 'var(--text-secondary)', textAlign: right ? 'right' : 'left', fontVariantNumeric: right ? 'tabular-nums' : undefined, whiteSpace: 'nowrap' }}>
    {children}
  </td>
)

// ── Summary card ──────────────────────────────────────────────
function SummaryCard({ label, gross, irs, net, color }) {
  return (
    <div style={{ padding: '16px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>{formatEuro(gross)}</div>
      <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem' }}>
        <span><span style={{ color: 'var(--text-muted)' }}>IRS: </span><span style={{ color: 'var(--red)' }}>−{formatEuro(irs)}</span></span>
        <span><span style={{ color: 'var(--text-muted)' }}>Líquido: </span><span style={{ color: 'var(--green)' }}>{formatEuro(net)}</span></span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function IRS() {
  const { data, saveData } = useApp()

  const currentYear = data?.currentYear ?? new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [exporting, setExporting] = useState(false)

  const availableYears = useMemo(() => {
    const years = new Set([currentYear, currentYear - 1])
    for (const y of Object.keys(data?.years || {}).map(Number)) years.add(y)
    return [...years].sort((a, b) => b - a)
  }, [data?.years, currentYear])

  const summary = useMemo(() => irsYearSummary(data, year), [data, year])

  const { dividends, bankInterest, aforroInterest, stockGains, cryptoGains } = summary

  // Cat. E — Rendimentos de Capitais
  const catEGross = dividends.totalGross + bankInterest.totalGross + aforroInterest.totalGross
  const catEIRS   = dividends.totalIRS   + bankInterest.totalIRS   + aforroInterest.totalIRS
  const catENet   = dividends.totalNet   + bankInterest.totalNet   + aforroInterest.totalNet

  // Cat. G — Mais-valias (apenas ganhos positivos geram IRS)
  const catGIRS   = stockGains.totalIRS + cryptoGains.totalIRS
  const catGGain  = stockGains.totalGain + cryptoGains.totalGain

  const hasAnyData = catEGross > 0 || stockGains.rows.length > 0 || cryptoGains.rows.length > 0

  async function handleExport() {
    setExporting(true)
    try {
      const csv = exportIRSCSV(data, year)
      await saveCSV(csv, `thrive-irs-${year}.csv`)
    } finally {
      setExporting(false)
    }
  }

  // Excel do Anexo G — histórico COMPLETO de vendas + dividendos (todos os
  // anos), para servir de arquivo mesmo décadas depois.
  const [exportingXlsx, setExportingXlsx] = useState(false)
  async function handleExportExcel() {
    setExportingXlsx(true)
    try {
      const base64 = await exportIrsExcelBase64(data)
      const filename = 'thrive-irs-vendas.xlsx'
      if (isElectron) {
        await window.api.showSaveDialog({
          defaultPath: filename, content: base64, encoding: 'base64',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        })
      } else {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExportingXlsx(false)
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Relatório IRS
          </h1>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Rendimentos de capitais — dividendos e juros
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text)', fontSize: '0.875rem', cursor: 'pointer', outline: 'none' }}
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button size="sm" variant="ghost" loading={exporting} onClick={handleExport}
            disabled={!hasAnyData}>
            <Download size={13} style={{ marginRight: 5 }} />
            Exportar CSV
          </Button>
          <Button size="sm" loading={exportingXlsx} onClick={handleExportExcel}
            disabled={!hasAnyData}
            title="Todas as vendas e dividendos de todos os anos, com valores de realização/aquisição, mais-valias e IRS estimado — pronto para o Anexo G"
            style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', color: 'var(--accent)' }}>
            <Download size={13} style={{ marginRight: 5 }} />
            Excel (Anexo G)
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, marginBottom: 28 }}>
        <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: 0 }}>
          Dados com carácter informativo — verifica sempre com o Portal das Finanças e com o teu contabilista.
          Dividendos sem imposto registado assumem retenção PT de 28 % (ajusta se necessário).
        </p>
      </div>

      {/* Summary cards */}
      {hasAnyData && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
          {dividends.totalGross > 0     && <SummaryCard label="Dividendos"       gross={dividends.totalGross}     irs={dividends.totalIRS}     net={dividends.totalNet}     color="#fbbf24" />}
          {bankInterest.totalGross > 0   && <SummaryCard label="Juros — Poupança" gross={bankInterest.totalGross}  irs={bankInterest.totalIRS}  net={bankInterest.totalNet}  color="#60a5fa" />}
          {aforroInterest.totalGross > 0  && <SummaryCard label="Juros — Aforro"  gross={aforroInterest.totalGross} irs={aforroInterest.totalIRS} net={aforroInterest.totalNet} color="#818cf8" />}
          {stockGains.totalGain !== 0    && <SummaryCard label="Mais-val. Ações/ETFs" gross={stockGains.totalProceeds} irs={stockGains.totalIRS}  net={stockGains.totalProceeds - stockGains.totalIRS} color="#4ade80" />}
          {cryptoGains.rows.length > 0   && <SummaryCard label="Mais-val. Crypto"     gross={cryptoGains.totalProceeds} irs={cryptoGains.totalIRS} net={cryptoGains.totalProceeds - cryptoGains.totalIRS} color="#f97316" />}
        </div>
      )}

      {!hasAnyData && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Info size={28} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: '0.875rem' }}>Sem dados de IRS registados em {year}.</p>
          <p style={{ fontSize: '0.775rem', marginTop: 6 }}>Regista dividendos em Ações, juros em Bancos, executa vendas para registar mais-valias.</p>
        </div>
      )}

      {/* ── Simulador: englobamento vs taxa autónoma ── */}
      {stockGains.rows.length > 0 && (
        <EnglobamentoCard
          gains={stockGains.totalGain}
          year={year}
          taxableIncome={data?.profile?.taxableIncome}
          onSetTaxableIncome={v => saveData({ profile: { ...(data?.profile || {}), taxableIncome: v } })}
        />
      )}

      {/* ── Section 1: Dividendos ── */}
      {dividends.rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            title="Dividendos"
            subtitle="Rendimentos registados em Ações & ETFs. Retenção estimada a 28 % quando não registada manualmente."
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Tipo</TH>
                  <TH>Ticker</TH>
                  <TH>Nome</TH>
                  <TH>Data</TH>
                  <TH right>Bruto</TH>
                  <TH right>IRS 28 %</TH>
                  <TH right>Líquido</TH>
                  <TH>Nota</TH>
                </tr>
              </thead>
              <tbody>
                {dividends.rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <TD muted>{r.source}</TD>
                    <TD><strong style={{ color: 'var(--text)' }}>{r.ticker}</strong></TD>
                    <TD muted>{r.name}</TD>
                    <TD muted>{r.date}</TD>
                    <TD right>{formatEuro(r.gross)}</TD>
                    <TD right red>−{formatEuro(r.irs)}</TD>
                    <TD right green>{formatEuro(r.amount)}</TD>
                    <TD muted>{r.taxIsEstimated ? '* estimado' : ''}</TD>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                  <td colSpan={4} style={{ padding: '8px 10px 8px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text)' }}>{formatEuro(dividends.totalGross)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--red)' }}>−{formatEuro(dividends.totalIRS)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--green)' }}>{formatEuro(dividends.totalNet)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Section 2: Juros bancários ── */}
      {bankInterest.rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            title="Juros — Poupança bancária"
            subtitle="Lidos do histórico de juros registado em Bancos por mês fechado."
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Plataforma</TH>
                  <TH>Conta</TH>
                  <TH>Período</TH>
                  <TH right>Bruto</TH>
                  <TH right>IRS</TH>
                  <TH right>Líquido</TH>
                </tr>
              </thead>
              <tbody>
                {bankInterest.rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <TD><strong style={{ color: 'var(--text)' }}>{r.platform}</strong></TD>
                    <TD muted>{r.account}</TD>
                    <TD muted>{r.month}</TD>
                    <TD right>{formatEuro(r.gross)}</TD>
                    <TD right red>−{formatEuro(r.irs)}</TD>
                    <TD right green>{formatEuro(r.net)}</TD>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                  <td colSpan={3} style={{ padding: '8px 10px 8px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text)' }}>{formatEuro(bankInterest.totalGross)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--red)' }}>−{formatEuro(bankInterest.totalIRS)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--green)' }}>{formatEuro(bankInterest.totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Section 3: Juros Aforro ── */}
      {aforroInterest.rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            title="Juros — Certificados de Aforro"
            subtitle="Calculados automaticamente com base nos dados de Aforro (IRS retido na fonte a 28 %)."
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Certificado</TH>
                  <TH>Subscrição</TH>
                  <TH right>Montante</TH>
                  <TH right>Juros brutos</TH>
                  <TH right>IRS 28 %</TH>
                  <TH right>Juros líquidos</TH>
                </tr>
              </thead>
              <tbody>
                {aforroInterest.rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <TD><strong style={{ color: 'var(--text)' }}>{r.name}</strong></TD>
                    <TD muted>{r.subscribeDate}</TD>
                    <TD right muted>{formatEuro(r.amount)}</TD>
                    <TD right>{formatEuro(r.grossInterest)}</TD>
                    <TD right red>−{formatEuro(r.irsWithheld)}</TD>
                    <TD right green>{formatEuro(r.netInterest)}</TD>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                  <td colSpan={3} style={{ padding: '8px 10px 8px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text)' }}>{formatEuro(aforroInterest.totalGross)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--red)' }}>−{formatEuro(aforroInterest.totalIRS)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--green)' }}>{formatEuro(aforroInterest.totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Section 4: Mais-valias — Ações & ETFs ── */}
      {stockGains.rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            title="Mais-valias — Ações & ETFs (Cat. G)"
            subtitle="Calculadas com Preço Médio Ponderado (PMP) — método fiscal português. IRS 28 % sobre ganhos positivos."
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Tipo</TH>
                  <TH>Ticker</TH>
                  <TH>Nome</TH>
                  <TH>Mês</TH>
                  <TH right>Recebido</TH>
                  <TH right>Custo PMP</TH>
                  <TH right>Ganho</TH>
                  <TH right>IRS 28 %</TH>
                  <TH>Nota</TH>
                </tr>
              </thead>
              <tbody>
                {stockGains.rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <TD muted>{r.type}</TD>
                    <TD><strong style={{ color: 'var(--text)' }}>{r.ticker}</strong></TD>
                    <TD muted>{r.name}</TD>
                    <TD muted>{r.date}</TD>
                    <TD right>{formatEuro(r.proceeds)}</TD>
                    <TD right muted>{formatEuro(r.cost)}</TD>
                    <TD right green={r.gain >= 0} red={r.gain < 0}>{r.gain >= 0 ? '+' : ''}{formatEuro(r.gain)}</TD>
                    <TD right red={r.irs > 0}>{r.irs > 0 ? `−${formatEuro(r.irs)}` : '—'}</TD>
                    <TD muted>{r.isFinalSell ? 'Venda total' : 'Parcial'}</TD>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                  <td colSpan={4} style={{ padding: '8px 10px 8px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text)' }}>{formatEuro(stockGains.totalProceeds)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatEuro(stockGains.totalCost)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: stockGains.totalGain >= 0 ? 'var(--green)' : 'var(--red)' }}>{stockGains.totalGain >= 0 ? '+' : ''}{formatEuro(stockGains.totalGain)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--red)' }}>{stockGains.totalIRS > 0 ? `−${formatEuro(stockGains.totalIRS)}` : '—'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Section 5: Mais-valias — Crypto ── */}
      {cryptoGains.rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            title="Mais-valias — Crypto (Cat. G)"
            subtitle="FIFO. Lotes detidos ≥ 365 dias são isentos de IRS (regime PT desde 2023). IRS 28 % sobre ganhos tributáveis."
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Plataforma</TH>
                  <TH>Ticker</TH>
                  <TH>Data</TH>
                  <TH right>Recebido</TH>
                  <TH right>Custo FIFO</TH>
                  <TH right>Ganho total</TH>
                  <TH right>Tributável</TH>
                  <TH right>Isento</TH>
                  <TH right>IRS 28 %</TH>
                </tr>
              </thead>
              <tbody>
                {cryptoGains.rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <TD><strong style={{ color: 'var(--text)' }}>{r.platform}</strong></TD>
                    <TD>{r.ticker}</TD>
                    <TD muted>{r.date}</TD>
                    <TD right>{formatEuro(r.proceeds)}</TD>
                    <TD right muted>{formatEuro(r.cost)}</TD>
                    <TD right green={r.gain >= 0} red={r.gain < 0}>{r.gain >= 0 ? '+' : ''}{formatEuro(r.gain)}</TD>
                    <TD right>{r.taxableGain > 0 ? formatEuro(r.taxableGain) : '—'}</TD>
                    <TD right green={r.exemptGain > 0}>{r.exemptGain > 0 ? formatEuro(r.exemptGain) : '—'}</TD>
                    <TD right red={r.taxDue > 0}>{r.taxDue > 0 ? `−${formatEuro(r.taxDue)}` : '€0 · Isento'}</TD>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                  <td colSpan={3} style={{ padding: '8px 10px 8px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text)' }}>{formatEuro(cryptoGains.totalProceeds)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatEuro(cryptoGains.totalCost)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: cryptoGains.totalGain >= 0 ? 'var(--green)' : 'var(--red)' }}>{cryptoGains.totalGain >= 0 ? '+' : ''}{formatEuro(cryptoGains.totalGain)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--text)' }}>{formatEuro(cryptoGains.totalTaxableGain)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--green)' }}>{formatEuro(cryptoGains.totalExemptGain)}</td>
                  <td style={{ padding: '8px 10px 8px 0', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'var(--red)' }}>{cryptoGains.totalIRS > 0 ? `−${formatEuro(cryptoGains.totalIRS)}` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Grand total — IRS estimado total */}
      {hasAnyData && (
        <div style={{ borderTop: '2px solid var(--border-strong)', paddingTop: 16, marginTop: 8 }}>
          {catEGross > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, fontSize: '0.82rem', marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'center' }}>Cat. E — Rendimentos Capitais</span>
              <span><span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Bruto:</span><strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(catEGross)}</strong></span>
              <span><span style={{ color: 'var(--text-muted)', marginRight: 8 }}>IRS retido:</span><strong style={{ color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>−{formatEuro(catEIRS)}</strong></span>
              <span><span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Líquido:</span><strong style={{ color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(catENet)}</strong></span>
            </div>
          )}
          {(stockGains.rows.length > 0 || cryptoGains.rows.length > 0) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'center' }}>Cat. G — Mais-valias</span>
              <span><span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Ganho total:</span><strong style={{ color: catGGain >= 0 ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{catGGain >= 0 ? '+' : ''}{formatEuro(catGGain)}</strong></span>
              <span><span style={{ color: 'var(--text-muted)', marginRight: 8 }}>IRS estimado:</span><strong style={{ color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>−{formatEuro(catGIRS)}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
