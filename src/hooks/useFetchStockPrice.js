import { useState, useCallback } from 'react'
import { monthInputToMk } from '../utils/dateUtils.js'

// ── Hook: fetch de preço de acção/ETF ─────────────────────────────
// Abstrai o padrão repetido em `AddHoldingForm` e `AddLotForm`:
//   1. `window.api.fetchStockPrice(ticker)` → preço actual + moeda.
//   2. `window.api.fetchStockHistory(ticker)` → pontos mensais; fica-se com o
//      match exacto (year/month) ou o ponto mais próximo ≤ target.
//
// Invariantes:
//   - `ticker` é normalizado para UPPERCASE antes de chamar a API.
//   - Se não há `monthInputValue` (ex: utilizador ainda não escolheu data),
//     devolve só `live`; `historical` fica null.
//   - Se o histórico falhou, `historical` fica null mas `live` pode ter preço.
//   - `fetchError` só fica true se **não** conseguir obter `live.price`
//     (o histórico é opcional — match exacto é best-effort).
//   - Devolve sempre uma Promise que resolve com `{ live, historical }`;
//     os consumidores decidem o que fazer (alguns usam só live, outros só histórico).
//
// Uso:
//   const { fetch: fetchPrice, loading, fetchError, clearError } = useFetchStockPrice()
//   const { live, historical } = await fetchPrice('AAPL', '2026-03') // "YYYY-MM"

/**
 * Função pura — retira um ponto histórico que corresponda a (year, month).
 * Fallback: último ponto ≤ target ordenado por (year, month).
 */
function pickHistoricalMatch(points, targetYear, targetMonth) {
  if (!points?.length) return null
  return (
    points.find(pt => pt.year === targetYear && pt.month === targetMonth)
    ?? points.filter(pt => (pt.year === targetYear && pt.month <= targetMonth) || pt.year < targetYear).at(-1)
    ?? null
  )
}

export { pickHistoricalMatch }

export function useFetchStockPrice() {
  const [loading, setLoading]       = useState(false)
  const [fetchError, setFetchError] = useState(false)

  const clearError = useCallback(() => setFetchError(false), [])

  const fetch = useCallback(async (rawTicker, monthInputValue) => {
    const ticker = String(rawTicker || '').trim().toUpperCase()
    if (!ticker) return { live: null, historical: null }
    setLoading(true)
    setFetchError(false)
    try {
      // Preço actual (sempre)
      const live = await window.api?.fetchStockPrice(ticker)
      // Preço histórico no mês escolhido (opcional)
      let historical = null
      if (monthInputValue) {
        const bMk = monthInputToMk(monthInputValue)
        if (bMk) {
          const [by, bm] = bMk.split('-').map(Number)
          const hist = await window.api?.fetchStockHistory(ticker)
          const match = pickHistoricalMatch(hist?.points, by, bm)
          if (match?.price) historical = { price: match.price, year: match.year, month: match.month }
        }
      }
      if (!live?.price) setFetchError(true)
      return { live: live || null, historical }
    } catch {
      setFetchError(true)
      return { live: null, historical: null }
    } finally {
      setLoading(false)
    }
  }, [])

  return { fetch, loading, fetchError, clearError }
}
