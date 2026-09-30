import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS_SHORT } from '../../data/initialData.js'

// ── Navegação mensal da página Dividas ───────────────────────────
// Setas ano anterior/próximo + 12 pills de mês. Futuros ficam
// desativados (não clicáveis) e o botão "próximo ano" também
// bloqueia acima do ano real.
export default function DividasMonthHeader({ viewYear, viewMonth, realYear, realMonth, onPrevYear, onNextYear, onSelectMonth }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <button
        onClick={onPrevYear}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}
      >
        <ChevronLeft size={15} />
      </button>

      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', minWidth: 36, textAlign: 'center' }}>
        {viewYear}
      </span>

      <div style={{ flex: 1, display: 'flex', gap: 3, overflowX: 'auto' }}>
        {MONTHS_SHORT.map((m, i) => {
          const active = viewMonth === i
          const isFuture = viewYear > realYear || (viewYear === realYear && i > realMonth)
          return (
            <button
              key={i}
              onClick={() => !isFuture && onSelectMonth(i)}
              style={{
                padding: '4px 10px', borderRadius: 20, border: 'none',
                background: active ? 'rgba(239,68,68,0.18)' : 'transparent',
                color: active ? '#ef4444' : isFuture ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 400, fontSize: '0.78rem',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.4 : 1, whiteSpace: 'nowrap',
              }}
            >
              {m}
            </button>
          )
        })}
      </div>

      <button
        onClick={onNextYear}
        disabled={viewYear >= realYear}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text-muted)', cursor: viewYear >= realYear ? 'default' : 'pointer',
          padding: '4px 8px', display: 'flex', alignItems: 'center',
          opacity: viewYear >= realYear ? 0.4 : 1,
        }}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
