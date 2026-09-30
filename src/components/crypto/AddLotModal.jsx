import { useState } from 'react'
import { formatEuro } from '../../data/initialData.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { S } from './constants.js'

// ── Modal: Reforço (novo lote) ───────────────────────────────────
// O prazo de 1 ano para isenção de IRS conta individualmente por lote.
// `gastoAuto = qty * preço` — sobreposto manualmente se preenchido.
export default function AddLotModal({ holding, onAdd, onClose }) {
  const [qty,   setQty]   = useState('')
  const [price, setPrice] = useState(String(holding.price ?? ''))
  const [gasto, setGasto] = useState('')
  const [date,  setDate]  = useState(new Date().toISOString().split('T')[0])

  const qtyN = parseFloat(String(qty).replace(',', '.'))
  const priceN = parseFloat(String(price).replace(',', '.'))
  const gastoN = parseFloat(String(gasto).replace(',', '.'))
  const gastoAuto  = !isNaN(qtyN) && !isNaN(priceN) ? +(qtyN * priceN).toFixed(2) : null
  const gastoFinal = !isNaN(gastoN) ? gastoN : (gastoAuto ?? 0)
  const valid = !isNaN(qtyN) && qtyN > 0 && !isNaN(priceN) && priceN >= 0 && date

  return (
    <Modal onClose={onClose} width={400}>
      <h3 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>
        Reforço · <span style={{ color: '#f59e0b' }}>{holding.ticker}</span>
      </h3>
      <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        Novo lote adicionado à posição existente. O prazo de 1 ano conta individualmente por lote.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Quantidade *',              el: <input autoFocus value={qty}   onChange={e => setQty(e.target.value)}   placeholder="0.5" style={S.input} /> },
          { label: 'Preço por unidade (€) *',   el: <input value={price}           onChange={e => setPrice(e.target.value)} style={S.input} /> },
          {
            label: `Total pago (€)${gastoAuto != null ? ' · ' + formatEuro(gastoAuto) : ''}`,
            el: <input value={gasto} onChange={e => setGasto(e.target.value)}
              placeholder={gastoAuto ? String(gastoAuto) : 'Opcional'} style={S.input} />,
          },
          { label: 'Data de compra *', el: <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} /> },
        ].map(({ label, el }, i) => (
          <div key={i}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
            {el}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid}
          onClick={() => { onAdd({ qty: qtyN, buyPrice: priceN, gasto: gastoFinal, buyDate: date }); onClose() }}
          style={{ background: '#f59e0b', border: 'none', color: '#000' }}>
          Adicionar lote
        </Button>
      </div>
    </Modal>
  )
}
