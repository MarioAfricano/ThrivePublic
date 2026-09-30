import { useState } from 'react'
import { X, Shield } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import {
  CRYPTO_TAX_FREE_DAYS as TAX_FREE_DAYS,
  daysSince, holdingQty, simulateSale,
} from '../../utils/calc/cryptoCalc.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { S } from './constants.js'
import { fmtQty, profitColor, badge } from './utils.js'

// Linha de simulação (um "cartão-mini" num grid 2 colunas).
function SimRow({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

// ── Modal: Calculadora IRS ───────────────────────────────────────
// Simula venda FIFO (não executa). Mostra receita, custo, ganho total,
// parte isenta (≥ 1 ano), parte tributável, e IRS a 28%. Em baixo,
// lista de lots com dias e estado de isenção.
export default function IRSCalcModal({ holding, onClose }) {
  const [sellQty, setSellQty] = useState('')
  const [sellPrice, setSellPrice] = useState(String(holding.price ?? ''))
  const maxQty = holdingQty(holding)
  const qtyN   = parseFloat(String(sellQty).replace(',', '.'))
  const priceN = parseFloat(String(sellPrice).replace(',', '.'))
  const sim = (!isNaN(qtyN) && qtyN > 0 && !isNaN(priceN) && priceN > 0)
    ? simulateSale(holding, qtyN, priceN) : null

  return (
    <Modal onClose={onClose} width={460}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>
          Calculadora IRS · <span style={{ color: '#f59e0b' }}>{holding.ticker}</span>
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
      </div>
      <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        Simula a venda usando o método FIFO (lotes mais antigos primeiro).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Quantidade a vender (máx: {fmtQty(maxQty)})
          </label>
          <input autoFocus value={sellQty} onChange={e => setSellQty(e.target.value)}
            placeholder={fmtQty(maxQty)} style={S.input} />
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Preço de venda (€/unidade)</label>
          <input value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={S.input} />
        </div>
      </div>

      {sim && (
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, marginBottom: 18, border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <SimRow label="Receita total" value={formatEuro(sim.totalProceeds)} />
            <SimRow label="Custo (FIFO)"  value={formatEuro(sim.totalCost)} />
            <SimRow label="Ganho total"   value={`${sim.totalGain >= 0 ? '+' : ''}${formatEuro(sim.totalGain)}`} color={profitColor(sim.totalGain)} />
            <SimRow label="Ganho isento ≥1 ano" value={formatEuro(sim.exemptGain)} color="var(--green)" />
            <SimRow label="Ganho sujeito a IRS"  value={formatEuro(sim.taxableGain)} color={sim.taxableGain > 0 ? '#fbbf24' : 'var(--text-secondary)'} />
            <div style={{
              background: sim.taxDue > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
              border: `1px solid ${sim.taxDue > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`,
              borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>IRS a pagar (28%)</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: sim.taxDue > 0 ? '#fbbf24' : 'var(--green)' }}>
                {sim.taxDue > 0 ? formatEuro(sim.taxDue) : '€0 · Isento'}
              </div>
            </div>
          </div>
          {sim.taxDue === 0 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: '0.75rem' }}>
              <Shield size={12} /> Esta venda estaria totalmente isenta de IRS.
            </div>
          )}
        </div>
      )}

      {/* Lista de lots em ordem FIFO */}
      <p style={{ margin: '0 0 8px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Lotes · Ordem FIFO
      </p>
      {[...(holding.lots || [])].sort((a, b) => new Date(a.buyDate || 0) - new Date(b.buyDate || 0)).map(lot => {
        const days = daysSince(lot.buyDate)
        const exempt = days >= TAX_FREE_DAYS
        const left = Math.max(0, TAX_FREE_DAYS - days)
        return (
          <div key={lot.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 10px', borderRadius: 8, marginBottom: 4,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{fmtQty(lot.qty)} {holding.ticker}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8 }}>{lot.buyDate || '—'} · {days}d</span>
            </div>
            <span style={{ ...badge(
              exempt ? 'var(--green)' : '#fbbf24',
              exempt ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
              exempt ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)',
            ) }}>
              {exempt ? '✓ Isento' : `${left}d para isenção`}
            </span>
          </div>
        )
      })}

      <Button variant="ghost" fullWidth onClick={onClose} style={{ marginTop: 16 }}>Fechar</Button>
    </Modal>
  )
}
