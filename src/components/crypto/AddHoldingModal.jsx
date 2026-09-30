import { useState } from 'react'
import { Shield } from 'lucide-react'
import { generateId as uid } from '../../utils/id.js'
import { formatEuro } from '../../data/initialData.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { S, GECKO_IDS, POPULAR_COINS } from './constants.js'

// ── Modal: Adicionar criptomoeda ─────────────────────────────────
// A primeira compra é o lote inicial. `fetchPrice` usa IPC em Electron
// (evita CORS em dev) com fallback para fetch directo ao CoinGecko.
// `gastoAuto = qty * preço` — pode ser sobreposto manualmente.
export default function AddHoldingModal({ onAdd, onClose }) {
  const [ticker, setTicker] = useState('')
  const [name,   setName]   = useState('')
  const [price,  setPrice]  = useState('')
  const [qty,    setQty]    = useState('')
  const [gasto,  setGasto]  = useState('')
  const [date,   setDate]   = useState(new Date().toISOString().split('T')[0])
  const [fetchingPrice, setFetchingPrice] = useState(false)

  async function fetchPrice(t) {
    const id = GECKO_IDS[t?.toUpperCase()]
    if (!id) return
    setFetchingPrice(true)
    try {
      // Em Electron passa pelo main process (evita CORS em dev); fallback fetch directo.
      const json = (typeof window !== 'undefined' && window.api?.fetchCryptoPrices)
        ? await window.api.fetchCryptoPrices([id])
        : await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=eur`, { signal: AbortSignal.timeout(5000) }).then(r => r.json())
      const p = json?.[id]?.eur
      if (p != null) setPrice(String(p))
    } catch { /* silencioso — o user pode preencher à mão */ }
    finally { setFetchingPrice(false) }
  }

  const qtyN = parseFloat(String(qty).replace(',', '.'))
  const priceN = parseFloat(String(price).replace(',', '.'))
  const gastoN = parseFloat(String(gasto).replace(',', '.'))
  const gastoAuto  = !isNaN(qtyN) && !isNaN(priceN) ? +(qtyN * priceN).toFixed(2) : null
  const gastoFinal = !isNaN(gastoN) ? gastoN : (gastoAuto ?? 0)
  const valid = ticker.trim() && !isNaN(qtyN) && qtyN > 0 && !isNaN(priceN) && priceN >= 0 && date

  function submit() {
    if (!valid) return
    const t = ticker.toUpperCase().trim()
    onAdd({
      ticker: t, name: name.trim() || t, price: priceN,
      lots: [{ id: uid(), qty: qtyN, buyPrice: priceN, gasto: gastoFinal, buyDate: date }],
    })
    onClose()
  }

  return (
    <Modal onClose={onClose} width={450}>
      <h3 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Adicionar Criptomoeda</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        A primeira compra é o lote inicial. Podes reforçar depois.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {POPULAR_COINS.map(c => (
          <button key={c.ticker} onClick={() => { setTicker(c.ticker); setName(c.name); fetchPrice(c.ticker) }}
            style={{
              background: ticker === c.ticker ? 'rgba(245,158,11,0.15)' : 'var(--bg)',
              border: `1px solid ${ticker === c.ticker ? '#f59e0b' : 'var(--border)'}`,
              borderRadius: 20, color: ticker === c.ticker ? '#f59e0b' : 'var(--text-secondary)',
              padding: '3px 10px', fontSize: '0.73rem', cursor: 'pointer', fontWeight: ticker === c.ticker ? 600 : 400,
            }}>{c.ticker}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'Ticker *',     el: <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="BTC"     style={S.input} /> },
          { label: 'Nome',         el: <input value={name}   onChange={e => setName(e.target.value)}                 placeholder="Bitcoin" style={S.input} /> },
          { label: 'Quantidade *', el: <input value={qty}    onChange={e => setQty(e.target.value)}                  placeholder="0.5"     style={S.input} /> },
          {
            label: fetchingPrice ? 'Preço de compra (€) · a buscar…' : 'Preço de compra (€) *',
            el: <input value={price} onChange={e => setPrice(e.target.value)}
              onBlur={() => { if (!price && ticker) fetchPrice(ticker) }}
              placeholder={fetchingPrice ? '…' : '50000'} style={S.input} />,
          },
          {
            label: `Total pago (€)${gastoAuto != null ? ' · auto: ' + formatEuro(gastoAuto) : ''}`,
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

      <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Shield size={11} /> A data de compra determina a isenção de IRS (≥ 1 ano).
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} onClick={submit}
          style={{ background: '#f59e0b', border: 'none', color: '#000' }}>Adicionar</Button>
      </div>
    </Modal>
  )
}
