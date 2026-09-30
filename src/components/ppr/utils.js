// ── Helpers numéricos para o gráfico partilhado ──────────────────

// Escolhe ticks "redondos" (1, 2, 2.5, 5, 10 × potências de 10) para
// o eixo Y até `count` divisões — evita ter labels feios tipo 1347.
export function niceYTicks(maxV, count = 3) {
  if (maxV <= 0) return []
  const raw = maxV / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const niceStep = [1, 2, 2.5, 5, 10].map(n => n * mag).find(n => n >= raw) ?? mag * 10
  const ticks = []
  for (let v = niceStep; v < maxV * 1.05; v += niceStep) ticks.push(Math.round(v))
  return ticks.slice(0, count + 1)
}

// Formata valor do eixo Y: ≥1000 vira "1k" / "1.5k".
export function fmtYVal(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return String(v)
}
