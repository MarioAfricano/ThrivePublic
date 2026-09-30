import { useState } from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { formatEuro } from '../../data/initialData.js'
import { buildXtbPlan, applyXtbImport } from '../../utils/importXtb.js'

// ── Modal: preview da importação XTB ───────────────────────────────
// Mostra o que foi encontrado no extrato, por ticker, e deixa escolher
// a categoria (Ação/ETF) dos tickers novos antes de aplicar. O dedupe
// por srcId torna seguro importar ficheiros sobrepostos.
export default function XtbImportModal({ data, parsed, onApply, onClose }) {
  const plan = buildXtbPlan(data, parsed)
  const [cats, setCats] = useState(() =>
    Object.fromEntries(plan.filter(r => r.isNew).map(r => [r.ticker, r.category])))
  const [applying, setApplying] = useState(false)

  const totals = plan.reduce((t, r) => ({
    buys: t.buys + r.nBuys, sells: t.sells + r.nSells, divs: t.divs + r.nDivs,
  }), { buys: 0, sells: 0, divs: 0 })

  async function handleApply() {
    setApplying(true)
    const { patch, counts } = applyXtbImport(data, parsed, cats)
    await onApply(patch, counts)
    onClose()
  }

  return (
    <Modal title="Importar extrato XTB" onClose={onClose} maxWidth={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Encontradas <strong>{totals.buys} compras</strong>, <strong>{totals.sells} vendas</strong> e{' '}
          <strong>{totals.divs} dividendos</strong> (líquidos de retenção).
          Operações já importadas antes são ignoradas automaticamente.
        </p>

        {parsed.warnings.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8 }}>
            <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {parsed.warnings.slice(0, 4).map((w, i) => <div key={i}>{w}</div>)}
              {parsed.warnings.length > 4 && <div>… e mais {parsed.warnings.length - 4}</div>}
            </div>
          </div>
        )}

        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr>
                {['Ticker', 'Nome', 'Compras', 'Vendas', 'Divs', 'Investido', 'Categoria'].map(hd => (
                  <th key={hd} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>{hd}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.map(r => (
                <tr key={r.ticker}>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--wa-03)' }}>
                    {r.ticker}
                    {r.isNew && <span style={{ marginLeft: 6, fontSize: '0.58rem', color: 'var(--accent)', fontWeight: 600 }}>novo</span>}
                  </td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--wa-03)', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td>
                  <td style={{ padding: '6px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--wa-03)', color: 'var(--text-secondary)' }}>{r.nBuys || '—'}</td>
                  <td style={{ padding: '6px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--wa-03)', color: r.nSells ? '#fbbf24' : 'var(--text-muted)' }}>{r.nSells || '—'}</td>
                  <td style={{ padding: '6px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--wa-03)', color: 'var(--text-secondary)' }}>{r.nDivs || '—'}</td>
                  <td style={{ padding: '6px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--wa-03)', color: 'var(--text-secondary)' }}>{r.totalGasto ? formatEuro(r.totalGasto) : '—'}</td>
                  <td style={{ padding: '4px 10px', borderBottom: '1px solid var(--wa-03)' }}>
                    {r.isNew ? (
                      <select value={cats[r.ticker]} onChange={e => setCats(c => ({ ...c, [r.ticker]: e.target.value }))}
                        style={{ padding: '3px 6px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--text)', fontSize: '0.7rem', cursor: 'pointer', outline: 'none' }}>
                        <option value="acoes">Ação</option>
                        <option value="etfs">ETF</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>existente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.75 }}>
          Compras entram como lotes com mês e preço; vendas como vendas parciais com o valor recebido exato;
          dividendos com a retenção na fonte registada. Novos tickers ficam na plataforma «XTB».
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
          <Button onClick={handleApply} loading={applying} style={{ flex: 1, background: 'var(--accent)' }}>
            <TrendingUp size={13} style={{ marginRight: 6 }} />
            Importar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
