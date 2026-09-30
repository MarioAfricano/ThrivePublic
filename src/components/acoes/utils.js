// ── Utilitários de formatação/cor para Ações & ETFs ──────────────
// Cor de lucro com dead-zone de ±0.5% para evitar ruído visual.
export function profitColor(v) {
  if (v > 0.005)  return 'var(--green)'
  if (v < -0.005) return '#ef4444'
  return 'var(--text-muted)'
}

export function profitSign(v) { return v >= 0 ? '+' : '' }

// Formata um preço na moeda nativa do ativo (ex: $ para USD, € para EUR).
export function formatNative(value, currency = 'EUR', decimals = 2) {
  if (value == null) return '—'
  const cur = currency?.toUpperCase() || 'EUR'
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency', currency: cur,
      minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 4),
    }).format(value)
  } catch {
    return `${value.toFixed(decimals)} ${cur}`
  }
}
