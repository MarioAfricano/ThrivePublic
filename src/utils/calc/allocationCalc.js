// ── Alocação alvo e rebalanceamento ────────────────────────────────
// Compara a distribuição actual do património com os alvos definidos
// pelo utilizador (percentagens 0–100 por categoria) e calcula quanto
// mover em € para reequilibrar.

// categories: [{ id, name, color, value }] (valores em EUR)
// targets:    { [id]: pct } — percentagens 0–100; categorias ausentes = sem alvo
export function allocationRows(categories, targets) {
  const total = (categories || []).reduce((s, c) => s + (c.value || 0), 0)
  const rows = (categories || [])
    .filter(c => (c.value || 0) > 0 || (targets?.[c.id] || 0) > 0)
    .map(c => {
      const actualPct = total > 0 ? (c.value / total) * 100 : 0
      const targetPct = targets?.[c.id] ?? null
      const deltaEur  = targetPct == null || total <= 0 ? null : (targetPct / 100) * total - (c.value || 0)
      const deltaPct  = targetPct == null ? null : actualPct - targetPct
      return { ...c, actualPct, targetPct, deltaPct, deltaEur }
    })
  const sumTargets = Object.values(targets || {}).reduce((s, v) => s + (v || 0), 0)
  return { rows, total, sumTargets }
}

// Sugere alvos a partir da distribuição actual: percentagens inteiras
// que somam exactamente 100 (o resto do arredondamento vai para a maior).
export function seedTargetsFromActual(categories) {
  const total = (categories || []).reduce((s, c) => s + (c.value || 0), 0)
  if (total <= 0) return {}
  const withPct = categories
    .filter(c => (c.value || 0) > 0)
    .map(c => ({ id: c.id, pct: (c.value / total) * 100 }))
  const targets = {}
  let sum = 0
  for (const { id, pct } of withPct) {
    targets[id] = Math.round(pct)
    sum += targets[id]
  }
  // Corrige o resto do arredondamento na categoria maior
  if (withPct.length && sum !== 100) {
    const biggest = withPct.reduce((a, b) => (a.pct >= b.pct ? a : b))
    targets[biggest.id] += 100 - sum
  }
  return targets
}
