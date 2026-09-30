import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../ui/Button.jsx'
import {
  getMK, MONTHS, MONTHS_SHORT, getPPRAccData,
} from '../../data/initialData.js'

// ── Cabeçalho de mês + botão "Novo Mês" ──────────────────────────
// Ano ± setas, 12 pills com destaque para meses com dados. Se o mês
// actual não tiver dados ainda, mostra botão "Novo mês" que
// inicializa todas as contas com o saldo final do mês anterior.
export default function PPRMonthHeader({ data, saveData, platforms }) {
  const year  = data?.currentYear  ?? new Date().getFullYear()
  const month = data?.currentMonth ?? new Date().getMonth()

  // Meses com dados para o ano actual.
  const monthsWithData = new Set()
  // 1. Meses inicializados explicitamente via "Novo Mês".
  for (const key of Object.keys(data?.ppr?.months || {})) {
    const [ky, km] = key.split('-').map(Number)
    if (ky === year) monthsWithData.add(km)
  }
  // 2. Meses com dados em contas (fonte secundária).
  for (const p of platforms) {
    for (const a of p.accounts) {
      for (const key of Object.keys(a.monthData || {})) {
        const [ky, km] = key.split('-').map(Number)
        if (ky === year) monthsWithData.add(km)
      }
    }
  }
  const currentHasData = monthsWithData.has(month)

  function setYM(y, m) { saveData({ currentYear: y, currentMonth: m }) }

  // "Novo Mês": inicializa mês actual com saldo do mês anterior.
  function createNewMonth() {
    const targetKey = getMK(year, month)
    let prevY = year, prevM = month - 1
    if (prevM < 0) { prevM = 11; prevY-- }
    const prevKey = getMK(prevY, prevM)

    const updatedPlatforms = platforms.map(p => ({
      ...p,
      accounts: p.accounts.map(a => {
        const prev = getPPRAccData(a, prevKey)
        return {
          ...a,
          monthData: {
            ...(a.monthData || {}),
            [targetKey]: { balance: prev.balance || 0 },
          },
        }
      }),
    }))
    saveData({
      ppr: {
        ...data.ppr,
        platforms: updatedPlatforms,
        months: { ...(data.ppr?.months || {}), [targetKey]: true },
      },
    })
  }

  const prevMonthLabel = month === 0 ? `Dez ${year - 1}` : MONTHS_SHORT[month - 1]

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
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
              const hasData  = monthsWithData.has(i)
              const isActive = i === month
              return (
                <button key={m} onClick={() => setYM(year, i)}
                  title={hasData ? m : `${m} — sem dados`}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: `1px solid ${isActive ? 'rgba(245,158,11,0.5)' : 'var(--border)'}`,
                    background: isActive ? 'rgba(245,158,11,0.18)' : 'transparent',
                    color: isActive ? '#f59e0b' : hasData ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer', opacity: hasData || isActive ? 1 : 0.35,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--wa-04)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>
        {!currentHasData && (
          <Button size="sm" icon={<Plus size={12} />} onClick={createNewMonth}
            title={`Inicializar ${MONTHS[month]} com saldo de ${prevMonthLabel}`}
            style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 20, color: 'var(--accent)' }}>
            Novo mês
          </Button>
        )}
      </div>
    </div>
  )
}
