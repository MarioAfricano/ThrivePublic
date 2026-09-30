// ── Helpers de formatação ─────────────────────────────────────

export function formatEuro(value, decimals = 2) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value)
}

// Percentagem a partir de um rácio (0.123 → "12,3 %").
// `opts` aceita um número (retrocompatível: nº de casas decimais) ou
// { decimals, signed }. `signed` mostra o sinal + nos valores positivos.
export function formatPct(value, opts = {}) {
  if (value == null) return '—'
  const { decimals = 1, signed = false } = typeof opts === 'number' ? { decimals: opts } : opts
  return new Intl.NumberFormat('pt-PT', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)
}

// Pontos percentuais (diferença entre duas percentagens), ex. "2,4 p.p."
export function formatPP(value, decimals = 1) {
  if (value == null) return '—'
  const n = new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value)
  return `${n} p.p.`
}
