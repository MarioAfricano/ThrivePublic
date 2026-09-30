import { useMemo } from 'react'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { formatEuro, MONTHS_SHORT } from '../../data/initialData.js'
import { computeUpcomingEvents } from '../../utils/upcomingEvents.js'

// ── Próximos eventos (Dashboard) ───────────────────────────────────
// Lista cronológica dos próximos 90 dias: débitos de dívidas, juros e
// maturidades do aforro, e o prazo da dedução PPR. Clique navega.
export default function UpcomingEventsCard() {
  const { data, setPage } = useApp()
  const events = useMemo(() => computeUpcomingEvents(data), [data])

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 2px' }}>
        <CalendarClock size={13} color="#60a5fa" /> Próximos eventos
      </h2>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Nos próximos 90 dias
      </p>

      {events.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7, margin: 0 }}>
          Nada agendado — sem débitos, juros ou prazos à vista.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {events.map((ev, i) => (
            <button key={i} onClick={() => setPage(ev.page)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                padding: '4px 6px', borderRadius: 7, fontSize: '0.73rem', color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--wa-04)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text)', width: 52, flexShrink: 0 }}>
                {ev.date.getDate()} {MONTHS_SHORT[ev.date.getMonth()].toLowerCase()}
              </span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</span>
              {ev.amount != null && (
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {ev.approx ? '~' : ''}{formatEuro(ev.amount)}
                </span>
              )}
              <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.4 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
