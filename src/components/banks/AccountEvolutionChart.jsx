import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatEuro, MONTHS_SHORT } from '../../data/initialData.js'

// ── Gráfico de evolução da conta ───────────────────────────────
// Mostra a linha do total (balance+interest) mês a mês para uma conta
// individual. Se houver menos de 2 pontos mostra placeholder.
export default function AccountEvolutionChart({ account /* , currentMK */ }) {
  const entries = Object.entries(account.monthData || {})
    .sort(([a], [b]) => {
      const [ya, ma] = a.split('-').map(Number)
      const [yb, mb] = b.split('-').map(Number)
      return ya !== yb ? ya - yb : ma - mb
    })
    .map(([key, d]) => {
      const [y, m] = key.split('-').map(Number)
      return {
        label: `${MONTHS_SHORT[m]} ${y !== (account.monthData ? Object.keys(account.monthData).map(k => parseInt(k)).sort((a,b)=>b-a)[0] : 2025) ? y : ''}`.trim(),
        value: (d.balance || 0) + (d.interest || 0),
        key,
      }
    })

  if (entries.length < 2) return (
    <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', padding: '8px 0', textAlign: 'center' }}>
      Precisa de dados em pelo menos 2 meses para mostrar o gráfico.
    </p>
  )

  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={entries} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip formatter={v => [formatEuro(v), 'Total']} labelStyle={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
        <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
