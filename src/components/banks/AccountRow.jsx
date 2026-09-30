import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  Trash2, BarChart2, TrendingUp, GripVertical,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  formatEuro, getAccData, CURRENCIES, compareMK,
} from '../../data/initialData.js'
import { EditableField } from '../ui/EditableField.jsx'
import TypeBadge from './TypeBadge.jsx'
import AccountEvolutionChart from './AccountEvolutionChart.jsx'

// ── Linha de conta ─────────────────────────────────────────────
// Uma linha dentro de um PlatformCard. Expõe `startEdit()` via ref para
// que o PlatformCard possa navegar por Tab entre contas consecutivas.
//
// As "sentinel keys" (_name, _taxRate, _currency) viajam dentro do objecto
// `accData` passado ao `onUpdate` — o PlatformCard separa-as e aplica-as
// à conta-raiz (em vez de ao `monthData[mk]`).
const AccountRow = forwardRef(function AccountRow({ account, mk, locked, onUpdate, onRemove, onTabNext, dragProps, isDragOver }, ref) {
  const [showHistory,   setShowHistory]   = useState(false)
  const [showEvolution, setShowEvolution] = useState(false)
  const { exchangeRates } = useApp()

  const accData  = getAccData(account, mk)
  const { balance = 0, interest = 0, interestHistory = [] } = accData
  const currency = account.currency || 'EUR'

  // Taxa de câmbio: se mês bloqueado usa taxa guardada, senão usa taxa ao vivo
  const liveRate    = currency !== 'EUR' ? (exchangeRates?.[currency] ?? accData.rateToEUR ?? 1.0) : 1.0
  const frozenRate  = accData.rateToEUR ?? 1.0
  const rateToEUR   = locked ? frozenRate : liveRate

  // Formatter para moedas não-EUR (mostra valor nativo sem símbolo €)
  const nativeFormatter = currency !== 'EUR'
    ? v => `${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
    : undefined

  function setField(field, val) {
    // Guarda sempre a taxa actual no monthData (congela no fecho do mês)
    onUpdate({ ...accData, [field]: val, rateToEUR })
  }

  const balanceRef  = useRef(null)
  const interestRef = useRef(null)

  // Expõe startEdit() para o componente pai navegar por Tab
  useImperativeHandle(ref, () => ({
    startEdit() { balanceRef.current?.startEdit() },
  }))

  const balanceEUR  = balance  * rateToEUR
  const interestEUR = interest * rateToEUR
  const totalEUR    = balanceEUR + interestEUR
  const hasHistory  = interestHistory.length > 0
  const hasEvolution = Object.keys(account.monthData || {}).filter(k => {
    // Só conta entradas a partir do startMK
    if (account.startMK && compareMK(k, account.startMK) < 0) return false
    return true
  }).length >= 2

  return (
    <div style={{
        borderTop: isDragOver ? '2px solid var(--accent)' : '1px solid var(--border)',
        padding: isDragOver ? '11px 16px 12px' : '12px 16px',
        background: isDragOver ? 'rgba(129,140,248,0.05)' : 'transparent',
        transition: 'background 0.1s, opacity 0.1s',
      }}
      {...(dragProps || {})}>
      {/* Linha principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {dragProps && (
          <GripVertical size={13} style={{ color: 'var(--text-muted)', opacity: 0.35, cursor: 'grab', flexShrink: 0 }} />
        )}
        <TypeBadge type={account.type} />
        <EditableField type="text" value={account.name} locked={locked} width={160} fontSize="0.85rem"
          onSave={v => onUpdate({ ...accData, _name: v })} />

        {/* Selector de moeda */}
        {!locked ? (
          <select value={currency}
            onChange={e => {
              const cur = e.target.value
              const newRate = cur === 'EUR' ? 1.0 : (exchangeRates?.[cur] ?? 1.0)
              onUpdate({ ...accData, _currency: cur, rateToEUR: newRate })
            }}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', fontSize: '0.65rem', padding: '2px 5px', cursor: 'pointer', outline: 'none' }}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : currency !== 'EUR' && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 5 }}>{currency}</span>
        )}

        {account.note && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{account.note}</span>}

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Saldo */}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 1 }}>Saldo</span>
            <EditableField type="currency" ref={balanceRef} value={balance} locked={locked}
              onSave={v => setField('balance', v)} formatter={nativeFormatter}
              onTab={account.type !== 'conta' ? () => interestRef.current?.startEdit() : onTabNext} />
            {currency !== 'EUR' && (
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                ≈ {formatEuro(balanceEUR)}
              </span>
            )}
          </span>

          {/* Juros */}
          {account.type !== 'conta' && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 1 }}>
                {account.type === 'poupanca_desconto' ? 'Juros (líq.)' : 'Juros'}
              </span>
              <EditableField type="currency" size="sm" ref={interestRef} value={interest} locked={locked}
                onSave={v => setField('interest', v)} formatter={nativeFormatter} onTab={onTabNext} />
              {currency !== 'EUR' && (
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                  ≈ {formatEuro(interestEUR)}
                </span>
              )}
            </span>
          )}

          {/* Taxa IRS */}
          {account.type === 'poupanca_desconto' && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 1 }}>Taxa IRS</span>
              <EditableField type="percent" size="sm" width={50} color="var(--yellow)"
                value={account.taxRate ?? 0.28} locked={locked}
                onSave={v => onUpdate({ ...accData, _taxRate: v })} />
            </span>
          )}

          {/* Total em EUR */}
          {account.type !== 'conta' && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 1 }}>Total{currency !== 'EUR' ? ' €' : ''}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalEUR)}</span>
            </span>
          )}

          {/* Toggle evolução */}
          {hasEvolution && (
            <button onClick={() => setShowEvolution(!showEvolution)} title="Evolução da conta"
              style={{ background: showEvolution ? 'var(--accent-dim)' : 'none', border: `1px solid ${showEvolution ? 'rgba(129,140,248,0.3)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', color: showEvolution ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', padding: '4px 5px' }}
              onMouseEnter={e => { if (!showEvolution) e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { if (!showEvolution) e.currentTarget.style.color = 'var(--text-muted)' }}>
              <TrendingUp size={13} />
            </button>
          )}

          {/* Toggle histórico juros */}
          {hasHistory && (
            <button onClick={() => setShowHistory(!showHistory)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <BarChart2 size={13} />{showHistory ? 'Esconder' : 'Juros'}
            </button>
          )}

          {/* Remover */}
          {!locked && (
            <button onClick={onRemove}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <Trash2 size={13} />
            </button>
          )}
        </span>
      </div>

      {/* Gráfico de evolução */}
      {showEvolution && (
        <div style={{ marginTop: 10, padding: '8px 0' }}>
          <AccountEvolutionChart account={account} currentMK={mk} />
        </div>
      )}

      {/* Tabela histórico de juros */}
      {showHistory && hasHistory && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table className="data-table" style={{ fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Bruto</th>
                <th>IRS ({((account.taxRate ?? 0.28) * 100).toFixed(0)}%)</th>
                <th>Líquido</th>
              </tr>
            </thead>
            <tbody>
              {interestHistory.map((row, i) => (
                <tr key={i}>
                  <td>{row.month}</td>
                  <td>{formatEuro(row.gross)}</td>
                  <td style={{ color: 'var(--red)' }}>-{formatEuro(row.gross - row.net)}</td>
                  <td style={{ color: 'var(--green)' }}>{formatEuro(row.net)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{formatEuro(interestHistory.reduce((s, r) => s + r.gross, 0))}</td>
                <td style={{ fontWeight: 700, color: 'var(--red)' }}>-{formatEuro(interestHistory.reduce((s, r) => s + (r.gross - r.net), 0))}</td>
                <td style={{ fontWeight: 700, color: 'var(--green)' }}>{formatEuro(interestHistory.reduce((s, r) => s + r.net, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})

export default AccountRow
