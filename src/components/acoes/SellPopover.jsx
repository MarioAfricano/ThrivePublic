import { useState, useId, useRef, useLayoutEffect } from 'react'
import { formatEuro, MONTHS_SHORT, getMK, mkToNum } from '../../data/initialData.js'
import { profitColor } from './utils.js'

// ── Popover de venda ────────────────────────────────────────────
// Formulário em `position: fixed` (fora do overflow da tabela) para
// confirmar a venda de uma posição: preço/ação, quantidade vendida e
// override manual do total recebido e MÊS DA VENDA. `anchor` são coords
// do viewport ({ top, right }) calculadas a partir do botão que o abriu.
// O estado dos inputs vive aqui — cada abertura começa limpa.
//
// O mês da venda começa no mês activo da app, mas pode ser mudado para
// registar vendas passadas sem ter de navegar até esse mês. Nunca pode
// ser anterior à primeira compra (`minMk`).
export default function SellPopover({
  displayPrice, displayQty, displayGasto, anchor, onConfirm, onClose,
  mk, minMk,
}) {
  const uid = useId()
  const priceRef = useRef(null)
  const popRef   = useRef(null)
  const [clampedTop, setClampedTop] = useState(null)

  // Foco no preço SEM scroll: `autoFocus` fazia o browser dar scrollIntoView
  // ao input. Como o popover é `position: fixed`, o browser satisfazia isso
  // rolando o contentor da página — a página fugia por baixo do popover e
  // parecia que este saltava para o topo.
  useLayoutEffect(() => {
    priceRef.current?.focus({ preventScroll: true })
  }, [])

  // Mantém o popover dentro do ecrã quando é aberto perto do fundo.
  useLayoutEffect(() => {
    const el = popRef.current
    if (!el || !anchor) return
    const h   = el.offsetHeight
    const max = window.innerHeight - h - 8
    setClampedTop(anchor.top > max ? Math.max(8, max) : anchor.top)
  }, [anchor])

  const [priceInput, setPriceInput] = useState('')
  const [qtyInput,   setQtyInput]   = useState('')
  const [totalInput, setTotalInput] = useState('') // override do total recebido

  const [curY, curM] = (mk || getMK(new Date().getFullYear(), new Date().getMonth())).split('-').map(Number)
  const [sellY, setSellY] = useState(curY)
  const [sellM, setSellM] = useState(curM)
  const sellMk = getMK(sellY, sellM)

  // Anos escolhíveis: do ano da primeira compra até ao ano activo.
  const minYear = minMk ? Number(minMk.split('-')[0]) : curY - 10
  const years   = Array.from({ length: Math.max(1, curY - minYear + 1) }, (_, i) => minYear + i)

  const beforeBuy = minMk != null && mkToNum(sellMk) < mkToNum(minMk)
  const isPast    = mkToNum(sellMk) < mkToNum(getMK(curY, curM))

  const sp         = parseFloat(priceInput.replace(',', '.')) || null
  const sq         = parseFloat(qtyInput.replace(',', '.'))   || null
  const stManual   = parseFloat(totalInput.replace(',', '.'))
  const spFinal    = sp ?? displayPrice ?? 0
  const sqFinal    = sq ?? displayQty   ?? 0
  const totalAuto  = spFinal * sqFinal
  const totalFinal = !isNaN(stManual) && totalInput.trim() !== '' ? stManual : totalAuto
  const lucro      = totalFinal - displayGasto

  const sinp = { background: 'var(--bg-elevated)', border: '1px solid var(--wa-15)', borderRadius: 5, color: 'var(--text)', padding: '3px 7px', fontSize: '0.7rem', outline: 'none', width: '100%' }

  function doSell() {
    if (beforeBuy) return
    onConfirm({ sellPrice: spFinal, sellQty: sqFinal, sellTotal: totalFinal, sellMk })
  }
  const onKey = e => { if (e.key === 'Enter') doSell(); if (e.key === 'Escape') onClose() }

  return (
    <div>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={onClose} />
      <div ref={popRef} style={{
        position: 'fixed',
        top:   anchor ? (clampedTop ?? anchor.top) : '50%',
        right: anchor ? anchor.right : 40,
        zIndex: 100,
        background: 'var(--bg-card)', border: '1px solid rgba(251,191,36,0.35)',
        borderRadius: 8, padding: '8px 10px', minWidth: 200,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--yellow)', marginBottom: 6 }}>Confirmar venda</div>
        {/* Mês da venda */}
        <div style={{ marginBottom: 5 }}>
          <label htmlFor={`${uid}-mes`} style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
            Mês da venda
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <select id={`${uid}-mes`} value={sellM} onChange={e => setSellM(Number(e.target.value))}
              style={{ ...sinp, width: 'auto', flex: 1 }}>
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <label htmlFor={`${uid}-ano`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              Ano da venda
            </label>
            <select id={`${uid}-ano`} value={sellY} onChange={e => setSellY(Number(e.target.value))}
              style={{ ...sinp, width: 'auto' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {beforeBuy && (
            <p style={{ fontSize: '0.55rem', color: 'var(--red)', marginTop: 3 }}>
              Anterior à primeira compra ({MONTHS_SHORT[Number(minMk.split('-')[1])]} {minMk.split('-')[0]}).
            </p>
          )}
          {!beforeBuy && isPast && (
            <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Venda passada: a posição deixa de aparecer a partir deste mês.
            </p>
          )}
        </div>
        {/* Preço / ação */}
        <div style={{ marginBottom: 5 }}>
          <label style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Preço / ação</label>
          <input ref={priceRef} placeholder={displayPrice ? String(+displayPrice.toFixed(4)) : 'preço'}
            value={priceInput} onChange={e => setPriceInput(e.target.value)}
            style={sinp} onKeyDown={onKey} />
        </div>
        {/* Qtd vendida */}
        <div style={{ marginBottom: 5 }}>
          <label style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Qtd vendida</label>
          <input placeholder={displayQty ? String(displayQty) : 'qtd'}
            value={qtyInput} onChange={e => setQtyInput(e.target.value)}
            style={sinp} onKeyDown={onKey} />
        </div>
        {/* Valor recebido (override) */}
        <div style={{ marginBottom: 7 }}>
          <label style={{ fontSize: '0.58rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ color: 'var(--text-muted)' }}>Valor recebido (€)</span>
            {totalInput.trim() === '' && totalAuto > 0 && <span style={{ fontSize: '0.52rem', color: 'var(--accent)', opacity: 0.7 }}>auto</span>}
          </label>
          <input
            placeholder={totalAuto > 0 ? formatEuro(totalAuto) : 'preço × qtd'}
            value={totalInput} onChange={e => setTotalInput(e.target.value)}
            style={{ ...sinp, borderColor: totalInput.trim() !== '' ? 'rgba(251,191,36,0.4)' : 'var(--wa-15)' }}
            onKeyDown={onKey} />
        </div>
        {/* Preview */}
        {totalFinal > 0 && (
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 7, padding: '4px 6px', background: 'var(--wa-03)', borderRadius: 5 }}>
            Recebido: <strong style={{ color: 'var(--text)' }}>{formatEuro(totalFinal)}</strong>
            {totalInput.trim() !== '' && <span style={{ marginLeft: 3, fontSize: '0.52rem', color: 'var(--yellow)' }}>(manual)</span>}
            {' · '}Lucro: <strong style={{ color: profitColor(lucro / (displayGasto || 1)) }}>{lucro >= 0 ? '+' : ''}{formatEuro(lucro)}</strong>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={doSell} disabled={beforeBuy}
            style={{ flex: 1, background: 'rgba(251,191,36,0.2)', color: 'var(--yellow)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 5, padding: '4px 0', fontSize: '0.65rem', fontWeight: 700, cursor: beforeBuy ? 'not-allowed' : 'pointer', opacity: beforeBuy ? 0.45 : 1 }}>
            Vender
          </button>
          <button onClick={onClose} aria-label="Cancelar venda"
            style={{ background: 'none', color: 'var(--text-muted)', border: '1px solid var(--wa-10)', borderRadius: 5, padding: '4px 7px', fontSize: '0.65rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
