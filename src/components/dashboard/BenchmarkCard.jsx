import { TrendingUp, TrendingDown, Info } from 'lucide-react'

function ReturnItem({ label, pct }) {
  const isUp = pct >= 0
  return (
    <div style={{
      flex: 1, padding: '10px 14px',
      background: 'var(--bg)', borderRadius: 10,
      border: `1px solid ${isUp ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'}`,
    }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {isUp
          ? <TrendingUp  size={12} color="var(--green)" aria-hidden />
          : <TrendingDown size={12} color="var(--red)"  aria-hidden />}
        <span style={{
          fontSize: '1rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
          color: isUp ? 'var(--green)' : 'var(--red)',
        }}>
          {isUp ? '+' : ''}{(pct * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

// Cartão comparativo: carteira vs SPY vs PSI-20 para o período activo.
// Não renderiza nada se não houver dados de benchmark disponíveis.
export default function BenchmarkCard({ portfolioReturn, spyReturn, psi20Return, period }) {
  if (spyReturn == null && psi20Return == null) return null

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Benchmarks</h2>
        {period && <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{period}</span>}
        <div title="SPY = S&P 500 ETF · PSI20.LS = iShares PSI-20 ETF · Dados via Alpha Vantage" style={{ marginLeft: 'auto', cursor: 'help', display: 'flex' }}>
          <Info size={11} color="var(--text-muted)" aria-hidden />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {portfolioReturn != null && <ReturnItem label="Carteira"      pct={portfolioReturn} />}
        {spyReturn       != null && <ReturnItem label="S&P 500 (SPY)" pct={spyReturn}       />}
        {psi20Return     != null && <ReturnItem label="PSI-20"         pct={psi20Return}     />}
      </div>
    </div>
  )
}
