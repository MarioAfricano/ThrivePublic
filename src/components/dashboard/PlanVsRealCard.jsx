import { Rocket } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { formatEuro } from '../../data/initialData.js'
import { planVsReal } from '../../utils/calc/projectionCalc.js'

// ── Plano vs. real ─────────────────────────────────────────────────
// Compara o património actual com a trajetória guardada na página
// Projeção ("Guardar como plano"). Sem plano, convida a criar um.
export default function PlanVsRealCard({ liveTotal }) {
  const { data, setPage } = useApp()
  const baseline = data?.projection?.baseline
  const result = planVsReal(baseline, liveTotal)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 2px' }}>
        <Rocket size={13} color="#34d399" /> Plano vs. real
      </h2>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        {result ? `Trajetória guardada há ${result.months} ${result.months === 1 ? 'mês' : 'meses'}` : 'Acompanha o teu plano de crescimento'}
      </p>

      {!result ? (
        <button onClick={() => setPage('projecao')}
          style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8, color: 'var(--accent)', padding: '8px 14px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
          Definir plano na Projeção
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Esperado hoje</p>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
              {formatEuro(result.expected)}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Real</p>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
              {formatEuro(liveTotal)}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Desvio</p>
            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: result.delta >= 0 ? 'var(--green)' : '#fbbf24' }}>
              {result.delta >= 0 ? '+' : ''}{formatEuro(result.delta)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
