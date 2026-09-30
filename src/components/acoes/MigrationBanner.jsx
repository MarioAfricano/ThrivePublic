import { formatEuro } from '../../data/initialData.js'

// ── Secção de migração de dados legacy ──────────────────────────
// Aparece apenas se houver holdings em `stocks._unclassified` (formato
// anterior que não distinguia Ação/ETF). Permite classificar um a um
// ou em bloco. Depois de classificados (ou dismissados em massa), o
// banner desaparece até à próxima migração.
export default function MigrationBanner({ unclassified, stocks, saveData }) {
  if (!unclassified || unclassified.length === 0) return null

  function classify(h, type) {
    const rest = unclassified.filter(u => u.id !== h.id)
    const target = type === 'acoes' ? 'acoes' : 'etfs'
    const current = stocks[target]?.holdings || []
    saveData({
      stocks: {
        ...stocks,
        _unclassified: rest,
        [target]: { ...(stocks[target] || {}), holdings: [...current, h] },
      },
    })
  }

  function dismissAll(type) {
    const target = type === 'acoes' ? 'acoes' : 'etfs'
    const current = stocks[target]?.holdings || []
    saveData({
      stocks: {
        ...stocks,
        _unclassified: [],
        [target]: { ...(stocks[target] || {}), holdings: [...current, ...unclassified] },
      },
    })
  }

  return (
    <div style={{
      border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10,
      background: 'rgba(251,191,36,0.05)', padding: '14px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', marginBottom: 2 }}>
            📦 Holdings não classificados ({unclassified.length})
          </p>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Estes holdings estavam no formato antigo. Classifica cada um como Ação ou ETF.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => dismissAll('acoes')}
            style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>
            Todos → Ações
          </button>
          <button onClick={() => dismissAll('etfs')}
            style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>
            Todos → ETFs
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {unclassified.map(h => {
          const value = (h.qty || 0) * (h.price || 0)
          return (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              background: 'var(--wa-03)', borderRadius: 6, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', minWidth: 60 }}>{h.ticker}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>
                {formatEuro(value)}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: 30 }}>{h.platform}</span>
              <button onClick={() => classify(h, 'acoes')}
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 5, padding: '3px 8px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>
                Ação
              </button>
              <button onClick={() => classify(h, 'etfs')}
                style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)', borderRadius: 5, padding: '3px 8px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>
                ETF
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
