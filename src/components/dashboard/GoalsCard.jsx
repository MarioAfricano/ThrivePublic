import { useState, useId } from 'react'
import { Flag, Plus, Trash2, Settings2 } from 'lucide-react'
import { formatEuro, MONTHS_SHORT } from '../../data/initialData.js'
import { goalProgress, goalActualPace, goalContributionPace, monthsToReach, GOAL_CATEGORY_LABELS } from '../../utils/calc/goalCalc.js'
import { EditableField } from '../ui/EditableField.jsx'

// ── Metas de poupança (Dashboard) ───────────────────────────────
// Lista de objetivos ("entrada para casa — 20.000€ até dez 2028"),
// cada um medido contra o valor ao vivo das categorias escolhidas.
// Dados em data.goals; cálculo em utils/calc/goalCalc.js.

const CATEGORY_IDS = Object.keys(GOAL_CATEGORY_LABELS)

// Rótulo "mês ano" para daqui a `months` meses
function futureLabel(now, months) {
  const idx = now.getFullYear() * 12 + now.getMonth() + months
  return `${MONTHS_SHORT[idx % 12]} ${Math.floor(idx / 12)}`
}

function GoalRow({ goal, data, liveSnap, years, year, month, now, onChange, onRemove }) {
  // Prefixo único por meta, para ligar <label> aos <select> do prazo.
  const goalId = useId()
  const [editing, setEditing]        = useState(false)
  const [confirmDel, setConfirmDel]  = useState(false)
  const p = goalProgress(goal, liveSnap, now)

  // Ritmo real → previsão de chegada. Preferência: aportes reais (fluxos
  // registados — não contam a valorização de mercado, que fica para o
  // retornoAnual); fallback: variação de valor por snapshots.
  const real = !p.atingido
    ? (goalContributionPace(goal, data, liveSnap, year, month)
        ?? goalActualPace(goal, years, p.atual, year, month))
    : null
  const etaMonths = real ? monthsToReach(p.atual, p.alvo, real.pace, goal.retornoAnual || 0) : null
  const etaOk = etaMonths != null && (p.mesesRestantes == null || etaMonths <= p.mesesRestantes)

  const barColor = p.atingido ? 'var(--green)' : p.expirado ? '#ef4444' : 'var(--accent)'
  const cats = goal.categorias?.length ? goal.categorias : CATEGORY_IDS
  const catsLabel = cats.length === CATEGORY_IDS.length
    ? 'todo o património'
    : cats.map(c => GOAL_CATEGORY_LABELS[c]).join(' + ')

  const deadlineLabel = goal.deadlineMK
    ? (() => { const [y, m] = goal.deadlineMK.split('-').map(Number); return `${MONTHS_SHORT[m]} ${y}` })()
    : null

  const yearNow = now.getFullYear()
  const [dy, dm] = goal.deadlineMK ? goal.deadlineMK.split('-').map(Number) : [yearNow + 2, 11]

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <EditableField type="text" value={goal.nome} onSave={v => v.trim() && onChange({ nome: v.trim() })}
          fontSize="0.78rem" fontWeight={700} color="var(--text)" width={140} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text)', fontWeight: 700 }}>
          {formatEuro(p.atual)}
        </span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/</span>
        <EditableField type="currency" value={goal.alvo} onSave={v => onChange({ alvo: Math.max(0, v) })}
          fontSize="0.72rem" fontWeight={600} width={80} />
        <button onClick={() => { setEditing(e => !e); setConfirmDel(false) }} title="Categorias e prazo"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2,
            color: editing ? 'var(--accent)' : 'var(--text-muted)' }}>
          <Settings2 size={12} />
        </button>
        <button
          onClick={() => { if (confirmDel) onRemove(); else setConfirmDel(true) }}
          onBlur={() => setConfirmDel(false)}
          title={confirmDel ? 'Clica outra vez para apagar' : 'Apagar meta'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 2,
            color: confirmDel ? '#ef4444' : 'var(--text-muted)' }}>
          {confirmDel && <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>apagar?</span>}
          <Trash2 size={12} />
        </button>
      </div>

      <div style={{ height: 6, background: 'var(--wa-06)', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ height: '100%', borderRadius: 99, background: barColor,
          width: `${p.pct}%`, transition: 'width 0.3s' }} />
      </div>

      <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0 }}>
        {p.pct.toFixed(0)}% · {catsLabel}
        {p.atingido && <span style={{ color: 'var(--green)', fontWeight: 600 }}> · atingida ✓</span>}
        {!p.atingido && deadlineLabel && (
          p.expirado
            ? <span style={{ color: '#ef4444', fontWeight: 600 }}> · prazo ({deadlineLabel}) passou — faltam {formatEuro(p.falta)}</span>
            : p.ritmoNecessario === 0
              ? <span style={{ color: 'var(--green)', fontWeight: 600 }}> · a {(goal.retornoAnual * 100).toFixed(0)}%/ano chegas lá sem reforços até {deadlineLabel} ✓</span>
              : <> · {formatEuro(p.ritmoNecessario)}/mês até {deadlineLabel}{goal.retornoAnual > 0 && ` (a ${(goal.retornoAnual * 100).toFixed(0)}%/ano)`}</>
        )}
        {!p.atingido && !deadlineLabel && <> · faltam {formatEuro(p.falta)}</>}
      </p>

      {real && (
        <p style={{ fontSize: '0.62rem', margin: '3px 0 0', color: 'var(--text-muted)' }}
          title={real.isFlow
            ? `Aportes reais dos últimos ${real.months} meses (compras − vendas, contribuições, subscrições; banco/poupança pela variação dos snapshots). A valorização de mercado fica para o retorno esperado.`
            : `Variação média dos últimos ${real.months} ${real.months === 1 ? 'mês' : 'meses'} (snapshots) — inclui valorização de mercado`}>
          {real.isFlow ? 'reforços' : 'ritmo'} {real.pace >= 0 ? '~' : ''}{formatEuro(real.pace)}/mês →{' '}
          {etaMonths == null
            ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>assim não chegas ao alvo</span>
            : <span style={{ color: etaOk ? 'var(--green)' : 'var(--yellow)', fontWeight: 600 }}>
                chegada ~{futureLabel(now, etaMonths)}{p.mesesRestantes != null && (etaOk ? ' ✓ dentro do prazo' : ' — depois do prazo')}
              </span>}
        </p>
      )}

      {editing && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {CATEGORY_IDS.map(id => {
              const active = cats.includes(id)
              return (
                <button key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    // Toggle sobre a lista efetiva; nunca deixar ficar vazia
                    const next = active ? cats.filter(c => c !== id) : [...cats, id]
                    if (next.length) onChange({ categorias: next })
                  }}
                  style={{
                    fontSize: '0.62rem', fontWeight: active ? 700 : 400, padding: '3px 9px', borderRadius: 99,
                    cursor: 'pointer', transition: 'background-color 0.1s, border-color 0.1s, color 0.1s',
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(129,140,248,0.45)' : 'var(--border)'}`,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {GOAL_CATEGORY_LABELS[id]}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.66rem', color: 'var(--text-muted)' }}>
            <label htmlFor={`${goalId}-prazo-mes`}>Prazo:</label>
            <select id={`${goalId}-prazo-mes`} value={goal.deadlineMK ? dm : ''}
              onChange={e => onChange({ deadlineMK: e.target.value === '' ? undefined : `${dy}-${e.target.value}` })}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5,
                color: 'var(--text)', fontSize: '0.66rem', padding: '2px 4px' }}>
              <option value="">sem prazo</option>
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            {goal.deadlineMK && (
              <>
                <label htmlFor={`${goalId}-prazo-ano`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  Ano do prazo
                </label>
                <select id={`${goalId}-prazo-ano`} value={dy}
                  onChange={e => onChange({ deadlineMK: `${e.target.value}-${dm}` })}
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5,
                    color: 'var(--text)', fontSize: '0.66rem', padding: '2px 4px' }}>
                  {Array.from({ length: 41 }, (_, i) => yearNow + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            <span style={{ marginLeft: 8 }}>Retorno esperado:</span>
            <EditableField type="percent" value={goal.retornoAnual ?? null}
              onSave={v => onChange({ retornoAnual: v > 0 ? Math.min(v, 0.5) : undefined })}
              placeholder="0%" fontSize="0.66rem" fontWeight={600} width={36}
              ariaLabel="Retorno anual esperado"
              title="Ex.: 7%/ano para ETFs mundiais. O ritmo passa a assumir crescimento composto do valor atual e dos reforços. 0% remove." />
            <span style={{ opacity: 0.7 }}>/ano</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GoalsCard({ data, liveSnap, years, year, month, goals = [], onSave }) {
  const now = new Date()

  const update = (id, patch) => onSave(goals.map(g => (g.id === id ? { ...g, ...patch } : g)))
  const remove = (id) => onSave(goals.filter(g => g.id !== id))
  const add = () => onSave([...goals, {
    id: `goal-${Date.now()}`,
    nome: 'Nova meta',
    alvo: 10000,
    categorias: ['poupanca'],
  }])

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 }}>
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
          <Flag size={13} color="#4ade80" /> Metas de poupança
        </h2>
        <button onClick={add}
          style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 7,
            color: 'var(--accent)', padding: '3px 9px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={11} /> meta
        </button>
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: goals.length ? 8 : 0 }}>
        Objetivos com alvo em € e prazo
      </p>

      {goals.length === 0 ? (
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '10px 0 0', opacity: 0.75 }}>
          Sem metas. Cria uma — ex.: «Entrada para casa», 20.000€ até 2028.
        </p>
      ) : (
        goals.map(g => (
          <GoalRow key={g.id} goal={g} data={data} liveSnap={liveSnap} years={years} year={year} month={month} now={now}
            onChange={patch => update(g.id, patch)} onRemove={() => remove(g.id)} />
        ))
      )}
    </div>
  )
}
