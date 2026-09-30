import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS_SHORT } from '../../data/initialData.js'

// ── Navegador de mês/ano (header do Dashboard) ─────────────────
// Uma coluna com dois blocos: (a) selector de ano — usa anos que
// tenham dados em `data.years` ou em `banks`; (b) 12 pastilhas de mês
// com opacidade reduzida nos meses sem dados.
export default function MonthNav({ data, saveData }) {
  const year      = data?.currentYear  ?? new Date().getFullYear()
  const month     = data?.currentMonth ?? new Date().getMonth()
  const platforms = data?.banks?.platforms || []
  const yearData  = data?.years || {}

  const monthsWithData = new Set()
  for (const p of platforms)
    for (const a of p.accounts)
      for (const key of Object.keys(a.monthData || {})) {
        const [ky, km] = key.split('-').map(Number)
        if (ky === year) monthsWithData.add(km)
      }
  for (const m of Object.keys(yearData[year]?.months || {})) monthsWithData.add(Number(m))

  const yearsSet = new Set(Object.keys(yearData).map(Number))
  for (const p of platforms)
    for (const a of p.accounts)
      for (const key of Object.keys(a.monthData || {}))
        yearsSet.add(Number(key.split('-')[0]))
  yearsSet.add(year)
  const years = [...yearsSet].sort()

  function setYM(y, m) { saveData({ currentYear: y, currentMonth: m }) }
  function prevYear() { const i = years.indexOf(year); if (i > 0) setYM(years[i-1], 11) }
  function nextYear() { const i = years.indexOf(year); if (i < years.length-1) setYM(years[i+1], 0); else setYM(year+1, 0) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      {/* Year nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }}>
        <button type="button" onClick={prevYear} aria-label="Ano anterior"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4 }}
          onMouseEnter={e => e.currentTarget.style.color='var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{year}</span>
        <button type="button" onClick={nextYear} aria-label="Ano seguinte"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4 }}
          onMouseEnter={e => e.currentTarget.style.color='var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      {/* Month pills */}
      <div role="group" aria-label={`Mês de ${year}`}
        style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {MONTHS_SHORT.map((m, i) => {
          const hasData = monthsWithData.has(i)
          const active  = i === month
          return (
            <button key={m} type="button" onClick={() => setYM(year, i)}
              aria-pressed={active}
              aria-label={`${m} de ${year}${hasData ? '' : ' (sem dados)'}`}
              style={{
                padding: '3px 8px', borderRadius: 6,
                border: `1px solid ${active ? 'rgba(129,140,248,0.5)' : hasData ? 'var(--border)' : 'transparent'}`,
                background: active ? 'rgba(129,140,248,0.15)' : 'transparent',
                color: active ? 'var(--accent)' : hasData ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: '0.7rem', fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                transition: 'background-color 0.12s, border-color 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background='var(--wa-04)'; e.currentTarget.style.color='var(--text)' }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=hasData?'var(--text-secondary)':'var(--text-muted)' }}}>
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}
