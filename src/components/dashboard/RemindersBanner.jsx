import { useState, useMemo } from 'react'
import { BellRing, X, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { computeReminders } from '../../utils/reminders.js'
import { getMonthPayments, getDebtPayoff } from '../../utils/calc/debtCalc.js'
import { buildLockMonthPatch } from '../../utils/lockMonth.js'
import { generateId } from '../../utils/id.js'

// ── Banner de lembretes ────────────────────────────────────────────
// Aparece no topo do Dashboard quando há avisos accionáveis (mês por
// fechar, aforro perto da maturidade, teto PPR, prestação pendente).
// Cada linha navega para a página respetiva; o X esconde até ao próximo
// arranque (estado de sessão, não persistido).
export default function RemindersBanner() {
  const { data, saveData, setPage } = useApp()
  const [hidden, setHidden] = useState(false)
  const reminders = useMemo(() => computeReminders(data), [data])

  // Ações rápidas: executam o mesmo patch que a UI da página respetiva
  // faria (fechar mês = BanksMonthHeader; pagamento = Dividas.handleAddPayment).
  function runAction(a) {
    if (a.type === 'lock-month') {
      // Fecha os três sistemas de lock (global, ações, crypto) de uma vez
      const patch = buildLockMonthPatch(data, a.y, a.m)
      if (Object.keys(patch).length) saveData(patch)
    } else if (a.type === 'pay-debt') {
      const newDebts = (data.debts || []).map(d => {
        if (d.id !== a.debtId) return d
        const existing = getMonthPayments(d, a.mk)
        const { currentBalance } = getDebtPayoff(d, a.mk)
        const valor = d.prestacaoMensal || 0
        return {
          ...d,
          pagamentos: {
            ...d.pagamentos,
            [a.mk]: [...existing, { id: generateId(), valor, saldoRestante: Math.max(0, currentBalance - valor) }],
          },
        }
      })
      saveData({ debts: newDebts })
    }
  }

  if (hidden || reminders.length === 0) return null

  return (
    <div role="status" aria-live="polite"
      style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.72rem', fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <BellRing size={12} aria-hidden="true" /> Lembretes ({reminders.length})
        </div>
        <button type="button" onClick={() => setHidden(true)}
          aria-label="Esconder lembretes até ao próximo arranque"
          title="Esconder até ao próximo arranque"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
          <X size={13} aria-hidden="true" />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {reminders.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setPage(r.page)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                padding: '5px 6px', borderRadius: 7, fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--wa-04)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: r.severity === 'warn' ? '#fbbf24' : 'var(--accent)',
              }} />
              <span style={{ flex: 1 }}>{r.message}</span>
              <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
            </button>
            {r.action && (
              <button onClick={() => runAction(r.action)}
                style={{
                  flexShrink: 0, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: 6, color: '#fbbf24', padding: '3px 10px', cursor: 'pointer',
                  fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,191,36,0.12)'}>
                {r.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
