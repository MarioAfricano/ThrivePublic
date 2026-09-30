import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { getMK, compareMK, formatEuro } from '../data/initialData.js'
import { CreditCard, Plus, LayoutDashboard } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import { generateId as uid } from '../utils/id.js'
import { getMonthPayments, getDebtPayoff } from '../utils/calc/debtCalc.js'
import DividasMonthHeader from '../components/dividas/DividasMonthHeader.jsx'
import DebtModal from '../components/dividas/DebtModal.jsx'
import DebtCard from '../components/dividas/DebtCard.jsx'
import KPI from '../components/dividas/KPI.jsx'

// ── Página Dívidas ───────────────────────────────────────────────
// Orquestra navegação mensal, CRUD de dívidas e de pagamentos.
// Componentes visuais vivem em `src/components/dividas/`.
//
// Modelo de dados (em `data.debts[]`):
//   { id, nome, banco, montanteInicial, prestacaoMensal, diaDebito,
//     inicioMK, ativa, pagamentos: { "YYYY-M": [{id, valor, saldoRestante}] } }
//
// `debtSettings.showOnDashboard` controla se o total em dívida
// aparece como card no Dashboard.
export default function Dividas() {
  const { data, saveData } = useApp()
  const realNow = new Date()
  const realYear = realNow.getFullYear()
  const realMonth = realNow.getMonth()

  const [viewYear, setViewYear] = useState(null)
  const [viewMonth, setViewMonth] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editDebt, setEditDebt] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const year = viewYear ?? realYear
  const month = viewMonth ?? realMonth
  const mk = getMK(year, month)
  const isCurrentMonth = year === realYear && month === realMonth

  const debts = data?.debts || []
  const showOnDashboard = data?.debtSettings?.showOnDashboard ?? false

  // Ativas que já começaram até ao mês visível.
  const activeDebts = debts.filter(d => {
    if (!d.ativa) return false
    if (d.inicioMK && compareMK(d.inicioMK, mk) > 0) return false
    return true
  })
  const inactiveDebts = debts.filter(d => !d.ativa)

  // Estatísticas do mês visível.
  const totalBalance = activeDebts.reduce((s, d) => s + getDebtPayoff(d, mk).currentBalance, 0)
  const totalMonthly = activeDebts.reduce((s, d) => s + d.prestacaoMensal, 0)
  const paidCount = activeDebts.filter(d => getMonthPayments(d, mk).length > 0).length

  function handlePrevYear() { setViewYear((viewYear ?? realYear) - 1); setViewMonth(null) }
  function handleNextYear() {
    const next = (viewYear ?? realYear) + 1
    if (next > realYear) return
    setViewYear(next); setViewMonth(null)
  }

  function handleSaveDebt(debt) {
    const existing = debts.find(d => d.id === debt.id)
    const newDebts = existing
      ? debts.map(d => d.id === debt.id ? debt : d)
      : [...debts, debt]
    saveData({ debts: newDebts })
    setShowAddModal(false)
    setEditDebt(null)
  }

  function handleAddPayment(debtId, pmk, payData) {
    const newDebts = debts.map(d => {
      if (d.id !== debtId) return d
      const existing = getMonthPayments(d, pmk)
      return {
        ...d,
        pagamentos: {
          ...d.pagamentos,
          [pmk]: [...existing, { id: uid(), ...payData }],
        },
      }
    })
    saveData({ debts: newDebts })
  }

  function handleDeletePayment(debtId, pmk, payId) {
    const newDebts = debts.map(d => {
      if (d.id !== debtId) return d
      const updated = getMonthPayments(d, pmk).filter(p => p.id !== payId)
      return {
        ...d,
        pagamentos: { ...d.pagamentos, [pmk]: updated },
      }
    })
    saveData({ debts: newDebts })
  }

  // Confirm pattern: 1º clique arma, 2º confirma. Timeout 3s limpa.
  function handleDelete(id) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(c => c === id ? null : c), 3000)
      return
    }
    saveData({ debts: debts.filter(d => d.id !== id) })
    setDeleteConfirm(null)
  }

  function toggleDashboard() {
    saveData({ debtSettings: { ...(data?.debtSettings || {}), showOnDashboard: !showOnDashboard } })
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Título + ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>Dívidas</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Acompanha os teus empréstimos e créditos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant={showOnDashboard ? 'danger' : 'ghost'}
            icon={<LayoutDashboard size={13} />}
            onClick={toggleDashboard}
          >
            {showOnDashboard ? 'Visível no Dashboard' : 'Oculto no Dashboard'}
          </Button>
          <Button
            icon={<Plus size={15} />}
            onClick={() => setShowAddModal(true)}
            style={{ background: '#ef4444', border: 'none', color: '#fff' }}
          >
            Nova dívida
          </Button>
        </div>
      </div>

      <DividasMonthHeader
        viewYear={year} viewMonth={month}
        realYear={realYear} realMonth={realMonth}
        onPrevYear={handlePrevYear}
        onNextYear={handleNextYear}
        onSelectMonth={m => setViewMonth(m)}
      />

      {activeDebts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <KPI label="Total em dívida" value={formatEuro(totalBalance, 0)} />
          <KPI label="Prestação base total" value={formatEuro(totalMonthly)} />
          <KPI label="Com pagamentos" value={`${paidCount} / ${activeDebts.length}`} />
        </div>
      )}

      {debts.length === 0 ? (
        <div className="card" style={{ padding: '52px 32px', textAlign: 'center' }}>
          <CreditCard size={36} color="var(--text-muted)" style={{ marginBottom: 14 }} />
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text)', fontSize: '1rem' }}>Sem dívidas registadas</p>
          <p style={{ margin: '0 0 22px', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Adiciona um empréstimo para o acompanhar aqui
          </p>
          <Button
            icon={<Plus size={15} />}
            onClick={() => setShowAddModal(true)}
            style={{ background: '#ef4444', border: 'none', color: '#fff' }}
          >
            Nova dívida
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activeDebts.map(debt => (
            <DebtCard
              key={debt.id}
              debt={debt}
              mk={mk}
              isCurrentMonth={isCurrentMonth}
              deleteConfirm={deleteConfirm}
              onAddPayment={(pmk, payData) => handleAddPayment(debt.id, pmk, payData)}
              onDeletePayment={(pmk, payId) => handleDeletePayment(debt.id, pmk, payId)}
              onEdit={d => setEditDebt(d)}
              onDelete={handleDelete}
            />
          ))}

          {activeDebts.length > 0 && inactiveDebts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          )}

          {inactiveDebts.length > 0 && (
            <>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>
                Liquidadas
              </p>
              {inactiveDebts.map(debt => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  mk={mk}
                  isCurrentMonth={false}
                  deleteConfirm={deleteConfirm}
                  onAddPayment={() => {}}
                  onDeletePayment={() => {}}
                  onEdit={d => setEditDebt(d)}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </div>
      )}

      {(showAddModal || editDebt) && (
        <DebtModal
          debt={editDebt}
          onSave={handleSaveDebt}
          onClose={() => { setShowAddModal(false); setEditDebt(null) }}
        />
      )}
    </div>
  )
}
