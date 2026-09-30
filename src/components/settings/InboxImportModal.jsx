import { useMemo, useState } from 'react'
import { Inbox, TrendingUp, AlertTriangle } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { formatEuro, MONTHS_SHORT } from '../../data/initialData.js'
import { buildXtbPlan, applyXtbImport, collectSrcIds } from '../../utils/importXtb.js'

// ── Modal: preview da Inbox ─────────────────────────────────────────
// Mostra TODAS as operações encontradas nos extratos da pasta Inbox,
// linha a linha, com checkbox — nada entra sem estar marcado. Linhas
// já importadas (srcId existente) aparecem acinzentadas e bloqueadas.
// Tickers novos têm select de categoria; tickers existentes recebem as
// operações como novos lotes/dividendos na holding que já têm.

function mkLabel(mk) {
  if (!mk) return '—'
  const [y, m] = String(mk).split('-').map(Number)
  return `${MONTHS_SHORT[m] ?? '?'} ${y}`
}

export default function InboxImportModal({ data, files, onApply, onClose }) {
  // Junta os extratos num só conjunto de operações. Ficheiros
  // sobrepostos (ex.: mensal + anual) produzem srcIds repetidos —
  // fica só a primeira ocorrência.
  const combined = useMemo(() => {
    const c = { buys: [], sells: [], dividends: [], warnings: [] }
    const seen = new Set()
    const push = (arr, list) => {
      for (const o of list) {
        if (o.srcId) {
          if (seen.has(o.srcId)) continue
          seen.add(o.srcId)
        }
        arr.push(o)
      }
    }
    for (const f of files) {
      push(c.buys, f.parsed.buys)
      push(c.sells, f.parsed.sells)
      push(c.dividends, f.parsed.dividends)
      c.warnings.push(...f.parsed.warnings)
    }
    return c
  }, [files])

  const existingIds = useMemo(() => collectSrcIds(data), [data])

  // Linhas para render: uma por operação, ordenadas por ticker + mês
  const rows = useMemo(() => {
    const r = [
      ...combined.buys.map(o => ({ kind: 'buy', o })),
      ...combined.sells.map(o => ({ kind: 'sell', o })),
      ...combined.dividends.map(o => ({ kind: 'div', o })),
    ].map(x => ({ ...x, imported: existingIds.has(x.o.srcId) }))
    return r.sort((a, b) =>
      (a.o.ticker || '').localeCompare(b.o.ticker || '') || String(a.o.mk).localeCompare(String(b.o.mk)))
  }, [combined, existingIds])

  const selectable = rows.filter(r => !r.imported)

  // Excluídos por srcId (default: tudo o que é novo vem marcado)
  const [excluded, setExcluded] = useState(() => new Set())
  const toggle = (srcId) => setExcluded(prev => {
    const next = new Set(prev)
    if (next.has(srcId)) next.delete(srcId); else next.add(srcId)
    return next
  })
  const allChecked = selectable.every(r => !excluded.has(r.o.srcId))
  const toggleAll = () => setExcluded(allChecked ? new Set(selectable.map(r => r.o.srcId)) : new Set())

  const isOn = (r) => !r.imported && !excluded.has(r.o.srcId)
  const nSelected = selectable.filter(r => isOn(r)).length

  // Plano por ticker (para os selects de categoria dos novos) — só
  // considera operações selecionadas, para não criar holdings de
  // tickers cujas linhas foram todas desmarcadas
  const selectedParsed = useMemo(() => ({
    buys:      combined.buys.filter(o => !existingIds.has(o.srcId) && !excluded.has(o.srcId)),
    sells:     combined.sells.filter(o => !existingIds.has(o.srcId) && !excluded.has(o.srcId)),
    dividends: combined.dividends.filter(o => !existingIds.has(o.srcId) && !excluded.has(o.srcId)),
    warnings:  [],
  }), [combined, existingIds, excluded])
  const plan = useMemo(() => buildXtbPlan(data, selectedParsed), [data, selectedParsed])
  const newTickers = plan.filter(r => r.isNew)

  const [cats, setCats] = useState({})
  const catFor = (t) => cats[t] ?? newTickers.find(r => r.ticker === t)?.category ?? 'acoes'

  const [applying, setApplying] = useState(false)
  async function handleApply() {
    setApplying(true)
    const catMap = Object.fromEntries(newTickers.map(r => [r.ticker, catFor(r.ticker)]))
    const { patch, counts } = applyXtbImport(data, selectedParsed, catMap)
    await onApply(patch, counts, files.map(f => f.name))
    onClose()
  }

  const kindLabel = { buy: 'Compra', sell: 'Venda', div: 'Dividendo' }
  const kindColor = { buy: 'var(--green)', sell: '#fbbf24', div: '#60a5fa' }
  const detail = (r) => {
    const o = r.o
    if (r.kind === 'buy')  return `${o.qty} × ${o.price ?? '—'} = ${formatEuro(o.gasto)}`
    if (r.kind === 'sell') return `${o.qty} → ${formatEuro(o.saleValue)}`
    return `${formatEuro(o.amount)}${o.tax ? ` (retido ${formatEuro(o.tax)})` : ''}`
  }

  return (
    <Modal title="Inbox — extratos por importar" onClose={onClose} maxWidth={680}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <Inbox size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span>
            {files.length === 1 ? <>Extrato <strong>{files[0].name}</strong></> : <><strong>{files.length} extratos</strong> ({files.map(f => f.name).join(', ')})</>}
            {' — '}desmarca o que não quiseres importar.
          </span>
        </div>

        {combined.warnings.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8 }}>
            <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {combined.warnings.slice(0, 4).map((w, i) => <div key={i}>{w}</div>)}
              {combined.warnings.length > 4 && <div>… e mais {combined.warnings.length - 4}</div>}
            </div>
          </div>
        )}

        {newTickers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: 8 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tickers novos (escolhe a categoria):</span>
            {newTickers.map(r => (
              <span key={r.ticker} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>
                {r.ticker}
                <select value={catFor(r.ticker)} onChange={e => setCats(c => ({ ...c, [r.ticker]: e.target.value }))}
                  style={{ padding: '2px 5px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--text)', fontSize: '0.68rem', cursor: 'pointer', outline: 'none' }}>
                  <option value="acoes">Ação</option>
                  <option value="etfs">ETF</option>
                </select>
              </span>
            ))}
          </div>
        )}

        <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', width: 30 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll}
                    disabled={!selectable.length} title="Selecionar tudo / nada" style={{ cursor: 'pointer' }} />
                </th>
                {['Ticker', 'Tipo', 'Mês', 'Detalhe', ''].map((hd, i) => (
                  <th key={i} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>{hd}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.o.srcId} style={{ opacity: r.imported ? 0.45 : isOn(r) ? 1 : 0.55 }}>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--wa-03)' }}>
                    <input type="checkbox" checked={isOn(r)} disabled={r.imported}
                      onChange={() => toggle(r.o.srcId)} style={{ cursor: r.imported ? 'default' : 'pointer' }} />
                  </td>
                  <td style={{ padding: '5px 10px', fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--wa-03)' }}>{r.o.ticker}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--wa-03)', color: kindColor[r.kind], fontWeight: 600 }}>{kindLabel[r.kind]}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--wa-03)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{mkLabel(r.o.mk)}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--wa-03)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{detail(r)}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--wa-03)', fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {r.imported ? 'já importado' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.75 }}>
          Tickers existentes recebem as operações como novos lotes/dividendos — nada é criado em duplicado.
          Depois de importar, os ficheiros são movidos para Inbox/importados (nunca apagados).
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Mais tarde</Button>
          <Button onClick={handleApply} loading={applying} disabled={!nSelected}
            style={{ flex: 1, background: 'var(--accent)' }}>
            <TrendingUp size={13} style={{ marginRight: 6 }} />
            Importar {nSelected} {nSelected === 1 ? 'operação' : 'operações'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
