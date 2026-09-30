// ── Comparação ano-a-ano ────────────────────────────────────────
// Compara o último snapshot mensal disponível de dois anos, categoria
// a categoria. Puro; a enriquecimento de aforro/ppr (recalculados ao
// vivo por mk, como no Dashboard) fica a cargo do componente.

export const COMPARE_CATEGORIES = [
  { id: 'poupanca', name: 'Poupança', color: '#818cf8' },
  { id: 'aforro',   name: 'Aforro',   color: '#60a5fa' },
  { id: 'acoes',    name: 'Ações',    color: '#4ade80' },
  { id: 'etfs',     name: 'ETFs',     color: '#22d3ee' },
  { id: 'ppr',      name: 'PPR',      color: '#f472b6' },
  { id: 'banco',    name: 'Banco',    color: '#fbbf24' },
  { id: 'crypto',   name: 'Cripto',   color: '#f97316' },
]

// Último mês do ano com snapshot: { m, snap } ou null.
export function lastSnapshotOfYear(years, y) {
  const months = years?.[y]?.months
  if (!months) return null
  for (let m = 11; m >= 0; m--) {
    if (months[m]) return { m, snap: months[m] }
  }
  return null
}

// Linhas de comparação + totais. pct é fração (0.4 = +40%); null quando
// a base é 0 (categoria nova nesse intervalo).
export function compareYearSnaps(snapA, snapB) {
  const rows = COMPARE_CATEGORIES.map(({ id, name, color }) => {
    const a = snapA?.[id] || 0
    const b = snapB?.[id] || 0
    return { id, name, color, a, b, delta: b - a, pct: a > 0 ? (b - a) / a : null }
  })
  const totalA = rows.reduce((s, r) => s + r.a, 0)
  const totalB = rows.reduce((s, r) => s + r.b, 0)
  return {
    rows,
    totalA,
    totalB,
    delta: totalB - totalA,
    pct: totalA > 0 ? (totalB - totalA) / totalA : null,
  }
}
