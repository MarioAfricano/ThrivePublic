// ── Camada de cálculos pura — Bancos & Poupanças ───────────────────
// Modelo de dados:
//   platform = { id, name, accounts: [acc] }
//   acc      = { id, type, currency, balance, interest, monthData: { [mk]: {...} },
//                rateToEUR?, startMK?, deletedFromMK? }
//   Tipos de conta:
//     'conta'              — conta à ordem (sem juros contabilizados)
//     'poupanca'           — poupança com juros (crédito integral)
//     'poupanca_desconto'  — poupança com retenção na fonte (IRS já descontado)
//
// Invariantes:
//   - Visibilidade mensal:
//       * startMK      > mk  → ainda não criada (escondida).
//       * deletedFromMK ≤ mk  → já apagada (escondida).
//   - getAccData devolve o snapshot `monthData[mk]` se existir; caso contrário
//     cai para os campos de raiz (balance/interest/rateToEUR).
//   - Conversão para EUR: delegada a `toEUR` (usa liveRates se fornecido, senão
//     rateToEUR guardado; moeda EUR nunca é convertida).
//   - `calcBancoTotal`  soma apenas o `balance` das contas tipo "conta".
//   - `calcSavingsTotal` soma `balance + interest` das contas com type !== "conta".
//   - `platformTotal`    soma `balance + interest` de todas as contas visíveis.
//
// Puro: nada de I/O, nada de React.

import { compareMK } from '../dateUtils.js'
import { toEUR } from '../currencyUtils.js'

/** Conta visível no mês mk? (startMK/deletedFromMK respeitados) */
export function isAccVisible(acc, mk) {
  if (!mk) return true
  if (acc?.startMK       && compareMK(acc.startMK, mk)       > 0) return false
  if (acc?.deletedFromMK && compareMK(acc.deletedFromMK, mk) <= 0) return false
  return true
}

/** Dados de uma conta para um mês (snapshot) ou fallback para campos de raiz. */
export function getAccData(acc, monthKey) {
  if (monthKey && acc?.monthData?.[monthKey]) return acc.monthData[monthKey]
  return {
    balance:         acc?.balance         || 0,
    interest:        acc?.interest        || 0,
    interestHistory: acc?.interestHistory || [],
    rateToEUR:       acc?.rateToEUR       ?? 1.0,
  }
}

/** Total de uma plataforma (balance + interest, todas as contas visíveis). */
export function platformTotal(platform, monthKey = null, liveRates = null) {
  return (platform?.accounts || [])
    .filter(a => isAccVisible(a, monthKey))
    .reduce((sum, acc) => {
      const d = getAccData(acc, monthKey)
      const balEUR = toEUR((d.balance || 0) + (d.interest || 0), acc, d, liveRates)
      return sum + balEUR
    }, 0)
}

/** Total poupanças (type !== 'conta'); inclui balance + interest. */
export function calcSavingsTotal(platforms, monthKey = null, liveRates = null) {
  return (platforms || []).reduce((sum, p) => {
    return sum + (p.accounts || [])
      .filter(a => a.type !== 'conta')
      .filter(a => isAccVisible(a, monthKey))
      .reduce((s, a) => {
        const d = getAccData(a, monthKey)
        const balEUR = toEUR((d.balance || 0) + (d.interest || 0), a, d, liveRates)
        return s + balEUR
      }, 0)
  }, 0)
}

/** Total contas à ordem (type === 'conta'); apenas balance, sem juros. */
export function calcBancoTotal(platforms, monthKey = null, liveRates = null) {
  return (platforms || []).reduce((sum, p) => {
    return sum + (p.accounts || [])
      .filter(a => a.type === 'conta')
      .filter(a => isAccVisible(a, monthKey))
      .reduce((s, a) => {
        const d = getAccData(a, monthKey)
        const balEUR = toEUR(d.balance || 0, a, d, liveRates)
        return s + balEUR
      }, 0)
  }, 0)
}
