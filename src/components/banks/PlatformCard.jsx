import { useState, useRef } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronUp, BarChart2, GripVertical,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useApp } from '../../context/AppContext.jsx'
import {
  formatEuro, platformTotal, MONTHS_SHORT, compareMK, isAccVisible,
} from '../../data/initialData.js'
import { EditableField } from '../ui/EditableField.jsx'
import AccountRow from './AccountRow.jsx'
import BarTip from './BarTip.jsx'
import { ACCOUNT_TYPES } from './constants.js'

// ── Card de plataforma ─────────────────────────────────────────
// Agrega as contas de um banco/plataforma. Responsável por:
//   - mostrar o total agregado em EUR e o gráfico da plataforma
//   - reordenar contas por drag-and-drop
//   - criar contas novas (com `startMK = mk` — só existem a partir deste mês)
//   - aplicar as "sentinel keys" (_name/_taxRate/_currency) vindas do AccountRow
//     à conta-raiz, enquanto o resto do patch vai para `monthData[mk]`
//   - soft-delete: marca `deletedFromMK` em vez de apagar (preserva histórico)
export default function PlatformCard({ platform, mk, locked, onUpdate, onRemove, isDragOver, dragHandleProps }) {
  const [expanded,      setExpanded]      = useState(true)
  const [showChart,     setShowChart]     = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const accRefs = useRef([])
  const [newAccName,    setNewAccName]    = useState('')
  const [newAccType,    setNewAccType]    = useState('conta')
  const [dragAccIdx,    setDragAccIdx]    = useState(null)
  const [overAccIdx,    setOverAccIdx]    = useState(null)

  const { exchangeRates } = useApp()
  const total = platformTotal(platform, mk, exchangeRates)

  // Gráfico derivado do monthData das contas (valores em EUR via rateToEUR)
  const chartEntries = (() => {
    const map = {}
    for (const acc of platform.accounts) {
      for (const [key, d] of Object.entries(acc.monthData || {})) {
        if (!isAccVisible(acc, key)) continue
        const rate = d.rateToEUR ?? 1.0
        const v = ((d.balance || 0) + (d.interest || 0)) * rate
        map[key] = (map[key] || 0) + v
      }
    }
    return Object.entries(map)
      .sort(([a], [b]) => compareMK(a, b))
      .map(([key, value]) => {
        const [, m] = key.split('-').map(Number)
        return { month: `${MONTHS_SHORT[m]}`, value, isCurrent: key === mk }
      })
  })()

  function updateAccount(updatedAcc, accData) {
    let newAcc = { ...updatedAcc }
    // Campos estruturais (sentinel keys) — afectam a conta-raiz, não o monthData
    if (accData._name     !== undefined) { newAcc.name     = accData._name;     delete accData._name }
    if (accData._taxRate  !== undefined) { newAcc.taxRate  = accData._taxRate;  delete accData._taxRate }
    if (accData._currency !== undefined) { newAcc.currency = accData._currency; delete accData._currency }
    // Guarda dados mensais (inclui rateToEUR se presente)
    newAcc.monthData = { ...(updatedAcc.monthData || {}), [mk]: accData }
    onUpdate({ ...platform, accounts: platform.accounts.map(a => a.id === newAcc.id ? newAcc : a) })
  }

  function removeAccount(id) {
    // Soft-delete: marca a conta como apagada a partir deste mês (dados históricos ficam)
    onUpdate({
      ...platform,
      accounts: platform.accounts.map(a => a.id === id ? { ...a, deletedFromMK: mk } : a),
    })
  }

  function addAccount() {
    if (!newAccName.trim()) return
    // Guardar posição do scroll antes de fechar o formulário (o browser faz scroll ao remover o input focado)
    const mainEl = document.getElementById('main-scroll')
    const savedScroll = mainEl?.scrollTop ?? 0
    const acc = {
      id: `${platform.id}-${Date.now()}`,
      name: newAccName.trim(),
      type: newAccType,
      balance: 0,
      currency: 'EUR',
      startMK: mk,  // conta existe apenas a partir deste mês
      ...(newAccType !== 'conta'            ? { interest: 0 }                         : {}),
      ...(newAccType === 'poupanca_desconto' ? { taxRate: 0.28, interestHistory: [] }  : {}),
      monthData: {
        [mk]: {
          balance: 0,
          rateToEUR: 1.0,
          ...(newAccType !== 'conta'            ? { interest: 0, interestHistory: [] } : {}),
        },
      },
    }
    onUpdate({ ...platform, accounts: [...platform.accounts, acc] })
    setNewAccName(''); setAddingAccount(false)
    // Restaurar scroll após o React re-renderizar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (mainEl) mainEl.scrollTop = savedScroll
      })
    })
  }

  function applyAccDragReorder(visibleAccs, fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const arr = [...visibleAccs]
    const [item] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, item)
    const visIds = arr.map(a => a.id)
    const others = platform.accounts.filter(a => !visIds.includes(a.id))
    onUpdate({ ...platform, accounts: [...visIds.map(id => platform.accounts.find(a => a.id === id)), ...others] })
  }

  return (
    <div className="card" style={{ overflow: 'hidden', outline: isDragOver ? '2px solid rgba(129,140,248,0.4)' : 'none', transition: 'outline 0.12s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
        {dragHandleProps && (
          <div {...dragHandleProps} title="Arrastar plataforma"
            style={{ cursor: 'grab', color: 'var(--text-muted)', opacity: 0.4, display: 'flex', flexShrink: 0 }}>
            <GripVertical size={15} />
          </div>
        )}
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: platform.color, flexShrink: 0 }} />
        <EditableField type="text" value={platform.name} locked={locked} width={160} fontSize="0.85rem"
          onSave={name => onUpdate({ ...platform, name })} />

        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {formatEuro(total)}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {chartEntries.length >= 2 && (
            <button onClick={() => setShowChart(!showChart)} title="Gráfico da plataforma"
              style={{ background: showChart ? 'var(--accent-dim)' : 'none', border: `1px solid ${showChart ? 'rgba(129,140,248,0.3)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', color: showChart ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', padding: '4px 6px' }}
              onMouseEnter={e => { if (!showChart) e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { if (!showChart) e.currentTarget.style.color = 'var(--text-muted)' }}>
              <BarChart2 size={14} />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {!locked && (
            <button onClick={onRemove}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Gráfico de barras da plataforma */}
      {showChart && chartEntries.length >= 2 && (
        <div style={{ padding: '0 18px 16px' }}>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={chartEntries} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={18}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<BarTip />} cursor={{ fill: 'var(--wa-03)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartEntries.map((entry, i) => (
                  <Cell key={i} fill={entry.isCurrent ? platform.color : `${platform.color}55`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Contas */}
      {expanded && (
        <div>
          {(() => {
            // Accounts stay in place during drag — only highlight target (no flickering)
            const visibleAccs = platform.accounts.filter(acc => isAccVisible(acc, mk))
            return visibleAccs.map((acc, i) => (
              <AccountRow key={acc.id} ref={el => { accRefs.current[i] = el }} account={acc} mk={mk} locked={locked}
                onUpdate={accData => updateAccount(acc, accData)}
                onRemove={() => removeAccount(acc.id)}
                onTabNext={i < visibleAccs.length - 1 ? () => accRefs.current[i + 1]?.startEdit() : undefined}
                isDragOver={overAccIdx === i && dragAccIdx !== i}
                dragProps={{
                  draggable: true,
                  onDragStart: e => { e.dataTransfer.effectAllowed = 'move'; setDragAccIdx(i) },
                  onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overAccIdx !== i) setOverAccIdx(i) },
                  onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverAccIdx(null) },
                  onDrop: e => { e.preventDefault(); applyAccDragReorder(visibleAccs, dragAccIdx, i); setDragAccIdx(null); setOverAccIdx(null) },
                  onDragEnd: () => { setDragAccIdx(null); setOverAccIdx(null) },
                }}
              />
            ))
          })()}

          {/* Adicionar conta */}
          {!locked && (addingAccount ? (
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Nome da conta" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') addAccount(); if (e.key === 'Escape') setAddingAccount(false) }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '6px 10px', fontSize: '0.82rem', outline: 'none', flex: 1, minWidth: 120 }} />
              <div style={{ display: 'flex', gap: 4 }}>
                {Object.entries(ACCOUNT_TYPES).map(([key, t]) => (
                  <button key={key} onClick={() => setNewAccType(key)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${newAccType === key ? t.color : 'var(--border)'}`, background: newAccType === key ? `${t.color}18` : 'transparent', color: newAccType === key ? t.color : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setAddingAccount(false)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={addAccount} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#818cf8,#6366f1)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Adicionar</button>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px' }}>
              <button onClick={() => setAddingAccount(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '4px 0' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <Plus size={13} /> Adicionar conta
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
