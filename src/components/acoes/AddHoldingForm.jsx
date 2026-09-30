import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatEuro, getMK } from '../../data/initialData.js'
import { generateId as uid } from '../../utils/id.js'
import { mkToMonthInput, monthInputToMk } from '../../utils/dateUtils.js'
import { useFetchStockPrice } from '../../hooks/useFetchStockPrice.js'
import { currentYear } from './constants.js'
import { profitColor } from './utils.js'

// ── Formulário para adicionar holding ────────────────────────────
// Primeira compra cria o primeiro lote. `fetchPrices` combina preço
// actual (para `livePrice`) com histórico do mês de compra (para
// pré-encher `buyPrice`). `gastoInput` permite override manual do
// valor pago total (útil quando a corretora cobrou taxas ocultas).
// Avisa quando o ticker+plataforma colide com um holding existente —
// nesse caso, ao submeter, o pai faz merge como lote novo.
export default function AddHoldingForm({ onAdd, onCancel, withDividends, defaultMk, existingHoldings = [] }) {
  const defaultMonth = mkToMonthInput(defaultMk) || mkToMonthInput(getMK(currentYear, new Date().getMonth()))

  const [ticker,    setTicker]    = useState('')
  const [name,      setName]      = useState('')
  const [qty,       setQty]       = useState('')
  const [buyPrice,  setBuyPrice]  = useState('')   // preço por ação
  const [gastoInput, setGastoInput] = useState('') // valor pago total (override manual)
  const [taxa,      setTaxa]      = useState('')
  const [platform,  setPlatform]  = useState('')
  const [buyMonth,  setBuyMonth]  = useState(defaultMonth)
  const [currency,  setCurrency]  = useState('')
  const [livePrice, setLivePrice] = useState(null)
  const { fetch: fetchStockPrice, loading, fetchError, clearError: setFetchError } = useFetchStockPrice()

  const qtyNum       = parseFloat(String(qty).replace(',', '.'))
  const buyPriceNum  = parseFloat(String(buyPrice).replace(',', '.'))
  const gastoAuto    = (!isNaN(qtyNum) && !isNaN(buyPriceNum)) ? +(qtyNum * buyPriceNum).toFixed(2) : null
  // Valor pago final: se o user escreveu algo usa esse, senão usa o auto-calculado
  const gastoManual  = gastoInput.trim() !== '' ? parseFloat(gastoInput.replace(',', '.')) : null
  const gastoFinal   = gastoManual !== null && !isNaN(gastoManual) ? gastoManual : gastoAuto

  async function fetchPrices(t, monthVal) {
    if (!t) return
    const { live, historical } = await fetchStockPrice(t, monthVal)
    if (live?.price) {
      setLivePrice(live.price)
      if (!currency) setCurrency(live.currency || 'EUR')
    }
    // Pré-enche buyPrice: histórico primeiro, fallback para preço actual
    if (historical?.price) {
      setBuyPrice(String(+historical.price.toFixed(4)))
    } else if (live?.price) {
      setBuyPrice(String(+live.price.toFixed(4)))
    }
  }

  async function onTickerBlur() {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    await fetchPrices(t, buyMonth)
  }

  async function onBuyMonthChange(val) {
    setBuyMonth(val)
    const t = ticker.trim().toUpperCase()
    if (t) await fetchPrices(t, val)
  }

  function submit() {
    const taxaVal    = parseFloat(String(taxa).replace(',', '.'))
    if (!ticker.trim() || isNaN(qtyNum) || isNaN(buyPriceNum)) return
    const finalBuyMk = monthInputToMk(buyMonth) || defaultMk || null
    const gasto      = gastoFinal ?? qtyNum * buyPriceNum
    const firstLot   = {
      id: uid(), buyMk: finalBuyMk, qty: qtyNum,
      price: buyPriceNum, gasto,
      taxa: isNaN(taxaVal) ? 0 : taxaVal,
    }
    onAdd({
      id: uid(),
      ticker: ticker.trim().toUpperCase(),
      name: name.trim() || ticker.trim().toUpperCase(),
      lots: [firstLot],
      price: livePrice ?? buyPriceNum,
      priceUpdatedAt: livePrice != null ? new Date().toISOString() : undefined,
      buyMk: finalBuyMk,
      platform: platform.trim() || '—',
      currency: currency.trim() || 'EUR',
      dividends: withDividends ? [] : undefined,
      monthData: finalBuyMk ? { [finalBuyMk]: { price: buyPriceNum, qty: qtyNum } } : {},
    })
  }

  const inp = {
    background: 'var(--bg-elevated)', border: '1px solid var(--wa-10)', borderRadius: 6,
    color: 'var(--text)', padding: '6px 10px', fontSize: '0.78rem', outline: 'none', width: '100%',
  }
  const canSubmit = !!(ticker.trim() && !isNaN(qtyNum) && qty && !isNaN(buyPriceNum) && buyPrice)

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--wa-06)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginBottom: 8 }}>

        {/* Ticker */}
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Ticker *</label>
          <input placeholder="ex: AAPL" value={ticker}
            onChange={e => { setTicker(e.target.value); setFetchError(false) }}
            onBlur={onTickerBlur}
            style={{ ...inp, textTransform: 'uppercase', borderColor: fetchError ? 'rgba(239,68,68,0.5)' : 'var(--wa-10)' }}
            onKeyDown={e => e.key === 'Enter' && submit()} />
          {loading
            ? <RefreshCw size={10} style={{ position: 'absolute', right: 8, bottom: 9, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            : fetchError
              ? <span title="Ticker não encontrado" style={{ position: 'absolute', right: 8, bottom: 7, fontSize: '0.65rem', color: '#ef4444' }}>✕</span>
              : buyPrice
                ? <span title="Preço encontrado" style={{ position: 'absolute', right: 8, bottom: 7, fontSize: '0.65rem', color: 'var(--green)' }}>✓</span>
                : null
          }
        </div>

        {/* Nome */}
        <div>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Nome</label>
          <input placeholder="opcional" value={name} onChange={e => setName(e.target.value)}
            style={inp} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {/* Mês de compra */}
        <div>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Mês de compra *</label>
          <input type="month" value={buyMonth} onChange={e => onBuyMonthChange(e.target.value)}
            style={{ ...inp, colorScheme: 'dark' }} />
        </div>

        {/* Quantidade */}
        <div>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Quantidade *</label>
          <input placeholder="ex: 3.5" value={qty} onChange={e => setQty(e.target.value)}
            style={inp} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {/* Preço por ação */}
        <div>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
            Preço/ação *
            {loading && <RefreshCw size={8} style={{ marginLeft: 4, color: 'var(--accent)', animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} />}
          </label>
          <input placeholder="auto-buscado" value={buyPrice}
            onChange={e => setBuyPrice(e.target.value)}
            style={inp} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {/* Valor pago total (overridable) */}
        <div>
          <label style={{ fontSize: '0.6rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>Valor pago (€)</span>
            {gastoManual === null && gastoAuto !== null && (
              <span style={{ fontSize: '0.55rem', color: 'var(--accent)', opacity: 0.7 }}>auto</span>
            )}
          </label>
          <input
            placeholder={gastoAuto !== null ? formatEuro(gastoAuto) : 'qtd × preço'}
            value={gastoInput}
            onChange={e => setGastoInput(e.target.value)}
            style={{ ...inp, borderColor: gastoManual !== null ? 'rgba(129,140,248,0.4)' : 'var(--wa-10)' }}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {/* Taxa */}
        <div>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Taxa/comissão (€)</label>
          <input placeholder="0" value={taxa} onChange={e => setTaxa(e.target.value)}
            style={inp} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {/* Plataforma */}
        <div>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Plataforma</label>
          <input placeholder="ex: DEGIRO" value={platform} onChange={e => setPlatform(e.target.value)}
            style={inp} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
      </div>

      {/* Resumo */}
      {gastoFinal !== null && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, padding: '6px 10px', background: 'rgba(129,140,248,0.06)', borderRadius: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Total pago: <strong style={{ color: 'var(--text)' }}>{formatEuro(gastoFinal)}</strong>
            {gastoManual !== null && <span style={{ marginLeft: 4, fontSize: '0.58rem', color: 'var(--accent)' }}>(manual)</span>}
          </span>
          {livePrice && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Valor actual: <strong style={{ color: 'var(--text)' }}>{formatEuro(qtyNum * livePrice)}</strong>
            </span>
          )}
          {livePrice && gastoFinal > 0 && (
            <span style={{ fontSize: '0.68rem', color: profitColor((qtyNum * livePrice - gastoFinal) / gastoFinal) }}>
              Lucro: <strong>{qtyNum * livePrice >= gastoFinal ? '+' : ''}{formatEuro(qtyNum * livePrice - gastoFinal)}</strong>
            </span>
          )}
          {currency && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Moeda: <strong style={{ color: 'var(--text)' }}>{currency}</strong></span>}
        </div>
      )}

      {/* Aviso de merge automático */}
      {(() => {
        const normPlat = p => (p || '—').trim().toLowerCase()
        const t = ticker.trim().toUpperCase()
        const willMerge = t && existingHoldings.find(
          x => x.ticker === t && normPlat(x.platform) === normPlat(platform.trim() || '—') && !x.sellMk
        )
        return willMerge ? (
          <div style={{ marginBottom: 6, padding: '4px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, fontSize: '0.65rem', color: '#fbbf24' }}>
            ⚡ Já tens <strong>{t}</strong>{platform.trim() ? ` na ${platform.trim()}` : ''} — este lote será adicionado à posição existente.
          </div>
        ) : null
      })()}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={submit} disabled={!canSubmit}
          style={{ background: canSubmit ? 'var(--accent)' : 'rgba(129,140,248,0.25)', color: canSubmit ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default' }}>
          Adicionar
        </button>
        <button onClick={onCancel}
          style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--wa-10)', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
