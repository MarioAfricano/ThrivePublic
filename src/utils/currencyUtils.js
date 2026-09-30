// ── Helpers de câmbio ─────────────────────────────────────────
//
// Convenção:
//   - A app usa EUR como moeda base.
//   - `liveRates[X]` = EUR por 1 unidade de X (carregado do Frankfurter em App.jsx).
//   - Cada conta bancária guarda em `monthData[mk].rateToEUR` a taxa congelada
//     para meses fechados. Meses abertos usam a taxa ao vivo.

// Resolve a taxa para uma moeda num momento específico.
//   - Se moeda == EUR → 1.0
//   - Se `locked` for true → usa a taxa guardada (frozen); senão tenta live.
//   - Fallback: rate guardado; depois 1.0
export function resolveRate(currency, { liveRates = null, monthData = null, locked = false } = {}) {
  if (!currency || currency === 'EUR') return 1.0
  const frozen = monthData?.rateToEUR
  if (locked) return frozen ?? 1.0
  const live = liveRates?.[currency]
  return live ?? frozen ?? 1.0
}

// Converte um valor numa moeda local para EUR usando as regras acima.
// Aceita a assinatura usada internamente pelos cálculos em initialData.js:
//   toEUR(amount, account, monthData, liveRates)
export function toEUR(amount, account, monthData, liveRates) {
  const currency = account?.currency || 'EUR'
  if (currency === 'EUR') return amount
  // Preferência: taxa ao vivo (mês aberto) > taxa guardada > 1.0
  const rate = liveRates?.[currency] ?? monthData?.rateToEUR ?? 1.0
  return amount * rate
}
