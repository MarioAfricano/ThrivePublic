import { LifeBuoy } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'
import { runwayMonths } from '../../utils/calc/incomeCalc.js'
import { EditableField } from '../ui/EditableField.jsx'

// ── Fundo de emergência (Dashboard) ────────────────────────────────
// Liquidez (banco + poupança + aforro) ÷ despesas mensais = meses de
// vida cobertos. Alvo clássico: 6 meses. Despesas em profile.monthlyExpenses.
const TARGET_MONTHS = 6

export default function EmergencyFundCard({ liveSnap, monthlyExpenses, onSetExpenses }) {
  const liquidity = (liveSnap?.banco || 0) + (liveSnap?.poupanca || 0) + (liveSnap?.aforro || 0)
  const months = runwayMonths(liquidity, monthlyExpenses)
  const color = months == null ? 'var(--text-muted)'
    : months >= TARGET_MONTHS ? 'var(--green)'
    : months >= 3 ? '#fbbf24' : '#ef4444'

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 2px' }}>
        <LifeBuoy size={13} color="#f97316" /> Fundo de emergência
      </h2>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Quantos meses aguentas só com a liquidez
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: months != null ? 10 : 0 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Despesas mensais</p>
          <EditableField type="number" value={monthlyExpenses ?? 0}
            onSave={v => onSetExpenses(Math.max(0, v))}
            formatter={v => (v > 0 ? formatEuro(v) : 'definir')}
            width={85} fontSize="0.95rem" fontWeight={700} />
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Liquidez</p>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
            {formatEuro(liquidity)}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cobertura</p>
          <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color }}>
            {months == null ? '—' : `${months.toFixed(1)} meses`}
          </p>
        </div>
      </div>

      {months != null && (
        <>
          <div style={{ height: 6, background: 'var(--wa-06)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              height: '100%', borderRadius: 99, background: color,
              width: `${Math.min(100, (months / TARGET_MONTHS) * 100)}%`, transition: 'width 0.3s',
            }} />
          </div>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0, opacity: 0.75 }}>
            Alvo: {TARGET_MONTHS} meses · liquidez = banco + poupança + aforro
            {months >= TARGET_MONTHS ? ' · objetivo cumprido ✓' : ` · faltam ${formatEuro(TARGET_MONTHS * monthlyExpenses - liquidity)}`}
          </p>
        </>
      )}
    </div>
  )
}
