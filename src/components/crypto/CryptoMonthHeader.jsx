import {
  Lock, Unlock, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { MONTHS, MONTHS_SHORT } from '../../data/initialData.js'

// ── Selector de ano + meses ──────────────────────────────────────
// Crypto usa sempre o ano/mês REAL como referência (não o currentMonth
// do dashboard). Meses futuros ficam desactivados. Mês em `lockedMonths`
// ganha um ponto amarelo no topo-direito da pastilha.
// O botão Fechar/Abrir actua sobre o mês actualmente visualizado.
export default function CryptoMonthHeader({
  viewYear, viewMonth, onViewYear, onViewMonth,
  isLocked, onLock, onUnlock, lockedMonths,
}) {
  // Usa a data real (não o mês do dashboard) para determinar meses futuros
  const realNow = new Date()
  const realYear = realNow.getFullYear()
  const realMonth = realNow.getMonth()

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      {/* Year + lock/unlock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <button onClick={() => onViewYear(viewYear - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', minWidth: 36, textAlign: 'center' }}>{viewYear}</span>
        <button onClick={() => onViewYear(Math.min(viewYear + 1, realYear))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: viewYear >= realYear ? 'var(--bg)' : 'var(--text-muted)', display: 'flex', padding: 2 }}>
          <ChevronRight size={15} />
        </button>
        <div style={{ flex: 1 }} />
        {isLocked ? (
          <button onClick={onUnlock} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 8, color: '#fbbf24', cursor: 'pointer',
            padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600,
          }}>
            <Unlock size={13} /> Abrir mês
          </button>
        ) : (
          <button onClick={onLock} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8, color: '#f59e0b', cursor: 'pointer',
            padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600,
          }}>
            <Lock size={13} /> Fechar mês
          </button>
        )}
      </div>

      {/* Pastilhas de mês */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {MONTHS_SHORT.map((m, i) => {
          const isViewActual = viewMonth === i
          const locked = (lockedMonths || []).includes(i)
          const isFuture = viewYear === realYear && i > realMonth
          return (
            <button key={i} onClick={() => !isFuture && onViewMonth(i)}
              disabled={isFuture}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem',
                fontWeight: isViewActual ? 700 : 500,
                cursor: isFuture ? 'default' : 'pointer',
                background: isViewActual
                  ? (isLocked && locked ? 'rgba(251,191,36,0.2)' : 'rgba(245,158,11,0.18)')
                  : 'var(--bg)',
                border: `1px solid ${isViewActual
                  ? (isLocked && locked ? 'rgba(251,191,36,0.5)' : 'rgba(245,158,11,0.5)')
                  : 'var(--border)'}`,
                color: isFuture ? 'var(--text-muted)' : isViewActual ? '#f59e0b' : 'var(--text-secondary)',
                position: 'relative',
              }}>
              {m}
              {locked && (
                <span style={{
                  position: 'absolute', top: -2, right: -2, width: 6, height: 6,
                  borderRadius: 3, background: '#fbbf24',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {isLocked && (
        <p style={{ margin: '10px 0 0', fontSize: '0.73rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Lock size={11} /> {MONTHS[viewMonth]} {viewYear} está fechado — preços congelados. Clica em "Abrir mês" para editar.
        </p>
      )}
    </div>
  )
}
