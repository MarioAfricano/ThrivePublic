import { useState, useEffect } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { generateId as uid } from '../../utils/id.js'
import { mkToMonthInput, monthInputToMk } from '../../utils/dateUtils.js'
import { useFetchStockPrice } from '../../hooks/useFetchStockPrice.js'
import { useApp } from '../../context/AppContext.jsx'

// ── Formulário para adicionar lote de compra (inline) ────────────
// Reforço de posição: busca preço histórico para o mês escolhido (com
// fallback para preço actual). `gastoInput` aceita override manual do
// valor total pago (não necessariamente qty × preço — útil para custos
// extra). Limpa os campos após submeter para permitir reforços seguidos.
export default function AddLotForm({ h, mk, onAdd }) {
  const defaultMonth = mkToMonthInput(mk) || ''
  const [buyMonth,   setBuyMonth]   = useState(defaultMonth)
  const [qty,        setQty]        = useState('')
  const [price,      setPrice]      = useState('')
  const [gastoInput, setGastoInput] = useState('') // valor pago total (override manual)
  const [taxa,       setTaxa]       = useState('')
  const { fetch: fetchStockPrice, loading, fetchError, clearError: setFetchError } = useFetchStockPrice()
  const { exchangeRates } = useApp()
  const fxRate = (h.currency && h.currency !== 'EUR') ? (exchangeRates?.[h.currency] ?? 1.0) : 1.0

  const qtyNum    = parseFloat(String(qty).replace(',', '.'))
  const priceNum  = parseFloat(String(price).replace(',', '.'))
  const gastoAuto = (!isNaN(qtyNum) && !isNaN(priceNum)) ? +(qtyNum * priceNum * fxRate).toFixed(2) : null
  // Valor pago final: se o user escreveu algo usa esse, senão usa o auto-calculado
  const gastoManual = gastoInput.trim() !== '' ? parseFloat(gastoInput.replace(',', '.')) : null
  const gastoFinal  = gastoManual !== null && !isNaN(gastoManual) ? gastoManual : gastoAuto
  const canSubmit = !!(qty && price && !isNaN(qtyNum) && !isNaN(priceNum))

  async function fetchPrices(monthVal) {
    if (!h.ticker) return
    const { live, historical } = await fetchStockPrice(h.ticker, monthVal)
    // Preço: histórico primeiro, fallback para preço actual
    if (historical?.price) {
      setPrice(String(+historical.price.toFixed(4)))
    } else if (live?.price) {
      setPrice(String(+live.price.toFixed(4)))
    }
  }

  // Busca preço logo que o componente abre (mês já está definido)
  useEffect(() => { if (defaultMonth) fetchPrices(defaultMonth) }, []) // eslint-disable-line

  function submit() {
    if (!canSubmit) return
    const taxaVal  = parseFloat(String(taxa).replace(',', '.'))
    const lotBuyMk = monthInputToMk(buyMonth) || mk || null
    const newLot   = {
      id: uid(), buyMk: lotBuyMk, qty: qtyNum,
      price: priceNum, gasto: gastoFinal ?? qtyNum * priceNum,
      taxa: isNaN(taxaVal) ? 0 : taxaVal,
    }
    onAdd(newLot)
    setQty(''); setPrice(''); setGastoInput(''); setTaxa('')
  }

  const inp = { background: 'var(--bg-elevated)', border: '1px solid var(--wa-10)', borderRadius: 5, color: 'var(--text)', padding: '3px 7px', fontSize: '0.7rem', outline: 'none' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
      <input type="month" value={buyMonth} style={{ ...inp, colorScheme: 'dark', width: 120 }}
        onChange={e => { setBuyMonth(e.target.value); fetchPrices(e.target.value) }} />
      <input placeholder="Qtd" value={qty} onChange={e => setQty(e.target.value)}
        style={{ ...inp, width: 60 }} onKeyDown={e => e.key === 'Enter' && submit()} />
      {/* Preço por ação */}
      <div style={{ position: 'relative' }}>
        <input placeholder="Preço/un." value={price} onChange={e => { setPrice(e.target.value); setFetchError(false) }}
          style={{ ...inp, width: 80, borderColor: fetchError ? 'rgba(239,68,68,0.5)' : 'var(--wa-10)' }}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {loading
          ? <RefreshCw size={8} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          : fetchError
            ? <span title="Ticker não encontrado" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: '#ef4444' }}>✕</span>
            : price
              ? <span title="Preço encontrado" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: 'var(--green)' }}>✓</span>
              : null
        }
      </div>
      {/* Valor pago (override) */}
      <input
        placeholder={gastoAuto !== null ? formatEuro(gastoAuto) : 'val. pago'}
        value={gastoInput}
        onChange={e => setGastoInput(e.target.value)}
        title="Valor total pago (deixa vazio para usar qtd × preço)"
        style={{ ...inp, width: 80, borderColor: gastoManual !== null ? 'rgba(129,140,248,0.4)' : 'var(--wa-10)' }}
        onKeyDown={e => e.key === 'Enter' && submit()} />
      <input placeholder="Taxa €" value={taxa} onChange={e => setTaxa(e.target.value)}
        style={{ ...inp, width: 60 }} onKeyDown={e => e.key === 'Enter' && submit()} />
      {gastoFinal !== null && (
        <span style={{ fontSize: '0.65rem', color: gastoManual !== null ? 'var(--accent)' : 'var(--text-muted)' }}>
          = {formatEuro(gastoFinal)}{gastoManual !== null && <span style={{ fontSize: '0.55rem', marginLeft: 2 }}>(manual)</span>}
        </span>
      )}
      <button onClick={submit} disabled={!canSubmit}
        style={{ background: canSubmit ? 'var(--accent)' : 'rgba(129,140,248,0.25)', color: canSubmit ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: '0.68rem', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 3 }}>
        <Plus size={10} /> Compra
      </button>
    </div>
  )
}
