import { useState } from 'react'
import {
  CreditCard, Plus, Check, Clock, Edit2, Trash2, X,
  ChevronDown, ChevronUp, CalendarClock,
} from 'lucide-react'
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { MONTHS, MONTHS_SHORT, formatEuro } from '../../data/initialData.js'
import ErrorBoundary from '../ErrorBoundary.jsx'
import {
  getMonthPayments, getAllPayments, getDebtPayoff, buildYearlyChart,
} from '../../utils/calc/debtCalc.js'
import PaymentModal from './PaymentModal.jsx'

// ── Cartão de dívida ─────────────────────────────────────────────
// Mostra nome/banco, saldo atual e barra de progresso (amortizado
// de montante inicial), pagamentos do mês visível (ou estado
// pendente com a prestação base), e dois painéis colapsáveis:
// histórico de todos os pagamentos + projeção anual até liquidação.
// Botão Eliminar usa padrão confirm: 1º clique arma, 2º elimina.
export default function DebtCard({ debt, mk, isCurrentMonth, deleteConfirm, onAddPayment, onDeletePayment, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)  // false | 'history' | 'chart'
  const [showPayModal, setShowPayModal] = useState(false)

  // Todos os pagamentos históricos até mk (inclusive).
  const allPaid = getAllPayments(debt, mk)
  const lastBalance = allPaid.length > 0 ? allPaid[allPaid.length - 1].saldoRestante : debt.montanteInicial

  // Só os pagamentos registados no mês visível.
  const monthPayments = getMonthPayments(debt, mk)
  const totalThisMonth = monthPayments.reduce((s, p) => s + p.valor, 0)

  const pct = debt.montanteInicial > 0 ? Math.max(0, Math.min(1, 1 - lastBalance / debt.montanteInicial)) : 0

  // Histórico: todos os pagamentos individuais, mais recente primeiro.
  const historyAll = [...allPaid].reverse()

  const diaInfo = debt.diaDebito >= 2
    ? `Debitada dia ${debt.diaDebito} — contabiliza no mês seguinte`
    : `Debitada dia ${debt.diaDebito}`

  const isDelConfirm = deleteConfirm === debt.id

  // Projeção: mês estimado de liquidação + taxa média mensal.
  const { monthsLeft, payoffYear, payoffMonth, monthlyRate } = getDebtPayoff(debt, mk)
  const yearsLeft = monthsLeft != null ? (monthsLeft / 12).toFixed(1) : null
  const chartPoints = buildYearlyChart(debt, mk)

  const chartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const val = payload[0]?.value ?? payload[1]?.value
    const isProj = payload[0]?.dataKey === 'projected' || (!payload[0]?.value && payload[1]?.value != null)
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.73rem' }}>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>{label}</p>
        <p style={{ margin: 0, color: isProj ? 'var(--text-muted)' : '#ef4444' }}>
          {isProj ? 'Projeção' : 'Real'}: {formatEuro(val, 0)}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CreditCard size={18} color="#ef4444" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{debt.nome}</p>
              {!debt.ativa && (
                <span style={{ fontSize: '0.65rem', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 8 }}>
                  Liquidada
                </span>
              )}
            </div>
            {debt.banco && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{debt.banco}</p>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {formatEuro(lastBalance, 0)}
            </p>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>em dívida</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div style={{ margin: '0 20px', height: 4, background: 'var(--bg)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${pct * 100}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
        <div style={{ margin: '5px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {(pct * 100).toFixed(1)}% amortizado de {formatEuro(debt.montanteInicial, 0)}
          </p>
          {payoffYear != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              <CalendarClock size={11} />
              Liquidação estimada: <strong style={{ color: 'var(--text-secondary)', marginLeft: 2 }}>{MONTHS_SHORT[payoffMonth]} {payoffYear}</strong>
              {yearsLeft && <span style={{ marginLeft: 4 }}>· {yearsLeft} anos</span>}
            </span>
          )}
        </div>

        {/* Secção do mês visível */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                {MONTHS[parseInt(mk.split('-')[1])]} {mk.split('-')[0]}
              </p>

              {monthPayments.length === 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: '#f59e0b', fontWeight: 600 }}>
                  <Clock size={13} strokeWidth={2} />
                  Pendente — base {formatEuro(debt.prestacaoMensal)}
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {monthPayments.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={13} color="#22c55e" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text)', flex: 1 }}>
                        {formatEuro(p.valor)}
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>→ {formatEuro(p.saldoRestante, 0)} restante</span>
                      </span>
                      {isCurrentMonth && (
                        <button
                          onClick={() => onDeletePayment(mk, p.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px 4px', display: 'flex', alignItems: 'center', borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {monthPayments.length > 1 && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Total: {formatEuro(totalThisMonth)} este mês
                    </p>
                  )}
                </div>
              )}

              <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{diaInfo}</p>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {debt.ativa && (
                <button
                  onClick={() => setShowPayModal(true)}
                  style={{ background: '#22c55e', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={12} /> Pagamento
                </button>
              )}
              <button
                onClick={() => onEdit(debt)}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => onDelete(debt.id)}
                style={{ background: isDelConfirm ? '#ef4444' : 'var(--bg)', border: `1px solid ${isDelConfirm ? '#ef4444' : 'var(--border)'}`, borderRadius: 8, color: isDelConfirm ? '#fff' : '#ef4444', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center', fontSize: '0.75rem', gap: 4 }}
              >
                {isDelConfirm ? 'Confirmar?' : <Trash2 size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Botões de expansão */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {historyAll.length > 0 && (
            <button
              onClick={() => setExpanded(x => x === 'history' ? false : 'history')}
              style={{ flex: 1, background: 'none', border: 'none', borderRight: '1px solid var(--border)', color: expanded === 'history' ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.75rem' }}
            >
              {expanded === 'history' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Histórico ({historyAll.length})
            </button>
          )}
          <button
            onClick={() => setExpanded(x => x === 'chart' ? false : 'chart')}
            style={{ flex: 1, background: 'none', border: 'none', color: expanded === 'chart' ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.75rem' }}
          >
            {expanded === 'chart' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Projeção
          </button>
        </div>

        {/* Painel de histórico */}
        {expanded === 'history' && (
          <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {historyAll.map((p, i) => {
              const [hy, hm] = p.mk.split('-').map(Number)
              return (
                <div key={`${p.mk}-${p.id}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: 60 }}>
                    {MONTHS_SHORT[hm]} {hy}
                  </span>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>
                      -{formatEuro(p.valor)}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatEuro(p.saldoRestante, 0)} restante
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Painel de projeção */}
        {expanded === 'chart' && (
          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Taxa mensal média</p>
                <p style={{ margin: '3px 0 0', fontSize: '0.9rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{formatEuro(monthlyRate)}/mês</p>
              </div>
              {payoffYear != null && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Liquidação estimada</p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                    {MONTHS[payoffMonth]} {payoffYear}
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>({yearsLeft} anos)</span>
                  </p>
                </div>
              )}
            </div>
            <div style={{ height: 160 }}>
              <ErrorBoundary name="chart:debt-yearly" variant="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartPoints} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip content={chartTooltip} />
                    <Line dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                    <Line dataKey="projected" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </ErrorBoundary>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.67rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Linha sólida = real · tracejado = projeção · pagamentos antecipados recalculam automaticamente
            </p>
          </div>
        )}
      </div>

      {showPayModal && (
        <PaymentModal
          debt={debt}
          mk={mk}
          lastBalance={lastBalance}
          onSave={payData => {
            onAddPayment(mk, payData)
            setShowPayModal(false)
          }}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </>
  )
}
