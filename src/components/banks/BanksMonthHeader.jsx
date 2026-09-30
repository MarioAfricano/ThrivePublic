import { useState, useEffect } from 'react'
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Lock, Unlock,
} from 'lucide-react'
import Button from '../ui/Button.jsx'
import {
  getMK, getAccData, MONTHS, MONTHS_SHORT, isAccVisible, DEFAULT_GOAL,
} from '../../data/initialData.js'
import { buildLockMonthPatch, buildUnlockMonthPatch } from '../../utils/lockMonth.js'

// ── Cabeçalho de mês + navegação ──────────────────────────────
// Controla o ano/mês activo (`data.currentYear`, `data.currentMonth`),
// mostra as pastilhas dos 12 meses com estado (com dados / fechado /
// activo), e concentra 3 acções:
//   - Fechar / Abrir mês (toggle em `years[y].lockedMonths`)
//   - Novo mês (inicializa `monthData[mk]` com os valores do mês anterior)
//   - Apagar mês (context-menu via botão direito nas pastilhas)
export default function BanksMonthHeader({ data, saveData, platforms }) {
  const year  = data?.currentYear  ?? new Date().getFullYear()
  const month = data?.currentMonth ?? new Date().getMonth()
  const lockedMonths = data?.years?.[year]?.lockedMonths || []
  const isLocked     = lockedMonths.includes(month)
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, monthIdx }

  // Meses com dados para o ano actual
  const monthsWithData = new Set()
  for (const p of platforms) {
    for (const a of p.accounts) {
      for (const key of Object.keys(a.monthData || {})) {
        const [ky, km] = key.split('-').map(Number)
        if (ky === year) monthsWithData.add(km)
      }
    }
  }
  const currentMonthHasData = monthsWithData.has(month)

  // Fechar menu de contexto ao clicar noutro sítio
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close, { once: true })
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  function setYM(y, m) { saveData({ currentYear: y, currentMonth: m }) }

  // Unificado: fecha/abre também ações e cripto (ver utils/lockMonth.js)
  function toggleLock() {
    const patch = isLocked
      ? buildUnlockMonthPatch(data, year, month)
      : buildLockMonthPatch(data, year, month)
    if (Object.keys(patch).length) saveData(patch)
  }

  // "Novo Mês" inicializa o mês ACTUAL com os valores do mês ANTERIOR
  function createNewMonth() {
    const targetKey = getMK(year, month)
    // Mês anterior (wrap para Dezembro do ano anterior se necessário)
    let prevY = year, prevM = month - 1
    if (prevM < 0) { prevM = 11; prevY-- }
    const prevKey = getMK(prevY, prevM)

    const updatedPlatforms = platforms.map(p => ({
      ...p,
      accounts: p.accounts.map(a => {
        if (!isAccVisible(a, targetKey)) return a
        const prev = getAccData(a, prevKey)
        return {
          ...a,
          monthData: {
            ...(a.monthData || {}),
            [targetKey]: {
              balance:         prev.balance || 0,
              interest:        0,
              interestHistory: [],
              rateToEUR:       prev.rateToEUR ?? 1.0,
            },
          },
        }
      }),
    }))
    // Fica no mês actual — não navega
    saveData({ banks: { ...data.banks, platforms: updatedPlatforms } })
  }

  // Apagar todos os dados de um mês (volta a estado "por criar")
  function deleteMonth(targetMonthIdx) {
    const targetMK = getMK(year, targetMonthIdx)

    const updatedPlatforms = platforms.map(p => ({
      ...p,
      accounts: p.accounts.map(a => {
        if (!a.monthData?.[targetMK]) return a
        const newMonthData = { ...(a.monthData) }
        delete newMonthData[targetMK]
        return { ...a, monthData: newMonthData }
      }),
    }))

    const prevYears = data?.years || {}
    const prevYear  = prevYears[year] || { goal: DEFAULT_GOAL, lockedMonths: [], months: {} }
    const newMonths = { ...prevYear.months }
    delete newMonths[targetMonthIdx]
    const newLocked = (prevYear.lockedMonths || []).filter(m => m !== targetMonthIdx)

    saveData({
      banks: { ...data.banks, platforms: updatedPlatforms },
      years: { ...prevYears, [year]: { ...prevYear, months: newMonths, lockedMonths: newLocked } },
    })
    setCtxMenu(null)
  }

  // Mês anterior para o tooltip do botão "Novo Mês"
  const prevMonthLabel = month === 0
    ? `Dez ${year - 1}`
    : MONTHS_SHORT[month - 1]

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* Ano + meses */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setYM(year - 1, 11)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', minWidth: 36, textAlign: 'center' }}>{year}</span>
            <button onClick={() => setYM(year + 1, 0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <ChevronRight size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {MONTHS_SHORT.map((m, i) => {
              const hasData   = monthsWithData.has(i)
              const isActive  = i === month
              const isMLocked = lockedMonths.includes(i)
              return (
                <button key={m}
                  onClick={() => setYM(year, i)}
                  onContextMenu={e => { e.preventDefault(); if (hasData) setCtxMenu({ x: e.clientX, y: e.clientY, monthIdx: i }) }}
                  title={hasData ? (isMLocked ? `${m} — fechado` : `${m} — clique direito para apagar`) : `${m} — sem dados`}
                  style={{
                    padding: '4px 10px', borderRadius: 20, position: 'relative',
                    border: `1px solid ${isActive ? (isMLocked ? 'rgba(251,191,36,0.5)' : 'rgba(245,158,11,0.5)') : 'var(--border)'}`,
                    background: isActive ? (isMLocked ? 'rgba(251,191,36,0.2)' : 'rgba(245,158,11,0.18)') : 'transparent',
                    color: isActive ? '#f59e0b' : hasData ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer', opacity: hasData || isActive ? 1 : 0.35,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--wa-04)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  {m}
                  {isMLocked && <span style={{ position: 'absolute', top: -2, right: -2, width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', border: '1px solid var(--bg-elevated)' }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Acções */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLocked ? (
            <Button size="sm" icon={<Unlock size={12} />} onClick={toggleLock}
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 20, color: '#f59e0b' }}>
              Abrir mês
            </Button>
          ) : (
            <Button size="sm" icon={<Lock size={12} />} onClick={toggleLock}
              disabled={!currentMonthHasData}
              title={!currentMonthHasData ? 'Inicializa o mês antes de o fechar' : ''}
              style={{ borderRadius: 20 }}>
              Fechar mês
            </Button>
          )}
          {!currentMonthHasData && !isLocked && (
            <Button size="sm" icon={<Plus size={12} />} onClick={createNewMonth}
              title={`Inicializar ${MONTHS[month]} com valores de ${prevMonthLabel}`}
              style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 20, color: 'var(--accent)' }}>
              Novo mês
            </Button>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: 4, zIndex: 9999, minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <button onClick={() => deleteMonth(ctxMenu.monthIdx)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 12px', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <Trash2 size={13} /> Apagar {MONTHS[ctxMenu.monthIdx]}
          </button>
        </div>
      )}
    </div>
  )
}
