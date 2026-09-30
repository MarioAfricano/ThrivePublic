import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { holdingQty, simulateSale } from '../../utils/calc/cryptoCalc.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { S } from './constants.js'
import { fmtQty, profitColor } from './utils.js'

// Mini-cartão reusado dentro do simulador (duplicado intencionalmente
// de IRSCalcModal — ambos locais ao domínio, não vale a pena abstrair).
function SimRow({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

// ── Modal: Venda parcial ou total ────────────────────────────────
// FIFO (lotes mais antigos primeiro). Avisa se a venda liquida a posição.
// O onSell é chamado com (qty, price) — a execução real (update dos lots
// e actualização de realizedProfit/Proceeds) acontece no HoldingRow.
export default function SellModal({ holding, onSell, onClose }) {
  const [sellQty,   setSellQty]   = useState('')
  const [sellPrice, setSellPrice] = useState(String(holding.price ?? ''))
  const maxQty  = holdingQty(holding)
  const qtyN    = parseFloat(String(sellQty).replace(',', '.'))
  const priceN  = parseFloat(String(sellPrice).replace(',', '.'))
  const valid   = !isNaN(qtyN) && qtyN > 0 && qtyN <= maxQty + 0.000001 && !isNaN(priceN) && priceN > 0
  const sim     = valid ? simulateSale(holding, Math.min(qtyN, maxQty), priceN) : null

  function confirm() {
    if (!valid) return
    onSell(Math.min(qtyN, maxQty), priceN)
    onClose()
  }

  return (
    <Modal onClose={onClose} width={460}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>
          Vender · <span style={{ color: '#f59e0b' }}>{holding.ticker}</span>
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
      </div>
      <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        Venda parcial ou total · FIFO · Disponível: <strong style={{ color: 'var(--text)' }}>{fmtQty(maxQty)} {holding.ticker}</strong>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quantidade *</label>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: sim.taxDue > 0 || qtyN >= maxQty ? 10 : 0 }}>
            <SimRow label="Receita total"   value={formatEuro(sim.totalProceeds)} />
            <SimRow label="Custo FIFO"      value={formatEuro(sim.totalCost)} />
            <SimRow label="Ganho realizado" value={`${sim.totalGain >= 0 ? '+' : ''}${formatEuro(sim.totalGain)}`} color={profitColor(sim.totalGain)} />
            <div style={{
              background: sim.taxDue > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
              border: `1px solid ${sim.taxDue > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`,
              borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>IRS estimado</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: sim.taxDue > 0 ? '#fbbf24' : 'var(--green)' }}>
                {sim.taxDue > 0 ? formatEuro(sim.taxDue) : '€0 · Isento'}
              </div>
            </div>
          </div>
          {qtyN >= maxQty - 0.000001 && (
            <p style={{ fontSize: '0.73rem', color: '#fb923c', display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}>
              <AlertCircle size={12} /> Estás a vender a posição inteira.
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} onClick={confirm}
          style={{ background: '#ef4444', border: 'none', color: '#fff' }}>
          Confirmar Venda
        </Button>
      </div>
    </Modal>
  )
}
