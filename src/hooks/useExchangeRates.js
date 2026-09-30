import { useState, useEffect } from 'react'
import { fetchWithRetry } from '../utils/apiClient.js'
import { toastBus } from '../utils/toastBus.js'

// ── Hook: taxas de câmbio ─────────────────────────────────────────
// Busca câmbios EUR-base ao montar (Frankfurter via IPC ou fetch directo)
// e volta a buscar a cada 30 min com a app aberta; actualiza `rateToEUR`
// em meses abertos. Invariantes:
//   - Formato devolvido: { EUR: 1.0, USD: 0.92, GBP: 0.86, ... }  — EUR por 1 X.
//   - `rates` começa null; fica null se a API falhar (offline / sem chave).
//   - Só reescreve `monthData[mk].rateToEUR` em meses NÃO-lockados (senão os
//     snapshots históricos mudariam, violando o invariante dos meses fechados).
//   - `setData` é chamado com `(prev) => newState` — seguro de chamar num efeito
//     one-shot porque não usa nenhuma closure externa.
//   - Refreshes periódicos falham em silêncio (só log): um portátil offline
//     não deve receber um toast de erro de meia em meia hora.
//
// Uso:
//   const { rates, updatedAt } = useExchangeRates(setData)

const isElectron = typeof window !== 'undefined' && !!window.api

// Intervalo partilhado de refresh (câmbios + preços cripto)
export const RATES_REFRESH_MS = 30 * 60 * 1000

export function useExchangeRates(setData) {
  const [rates, setRates] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = (silent) => {
    const fetcher = (isElectron && window.api?.fetchExchangeRates)
      ? window.api.fetchExchangeRates()
      : fetchWithRetry('https://api.frankfurter.dev/v1/latest?from=EUR')

    Promise.resolve(fetcher)
      .then(json => {
        if (cancelled) return
        if (!json?.rates) {
          if (!silent) toastBus.emit('Sem ligação — taxas de câmbio não atualizadas.')
          if (isElectron) window.api?.logError({ type: 'network', source: 'exchange-rates', message: 'IPC returned null/no rates' })
          return
        }
        // json.rates: { USD: 1.08, GBP: 0.86, ... } — X por 1 EUR
        // Queremos EUR por 1 X → rateToEUR[X] = 1 / json.rates[X]
        const next = { EUR: 1.0 }
        for (const [cur, r] of Object.entries(json.rates || {})) {
          next[cur] = 1 / r
        }
        setRates(next)
        setUpdatedAt(Date.now())
        // Actualiza rateToEUR nos meses abertos, sem triggerar snapshot financeiro
        setData(prev => {
          if (!prev) return prev
          const years = prev.years || {}
          const newPlatforms = (prev.banks?.platforms || []).map(p => ({
            ...p,
            accounts: p.accounts.map(a => {
              const currency = a.currency || 'EUR'
              if (currency === 'EUR') return a
              const rate = next[currency] || 1.0
              const newMonthData = { ...(a.monthData || {}) }
              for (const mk of Object.keys(newMonthData)) {
                const [y, m] = mk.split('-').map(Number)
                const isLocked = (years[y]?.lockedMonths || []).includes(m)
                if (!isLocked) {
                  newMonthData[mk] = { ...newMonthData[mk], rateToEUR: rate }
                }
              }
              return { ...a, monthData: newMonthData }
            }),
          }))

          // Ações & ETFs: mesma regra dos bancos — grava rateToEUR nos
          // snapshots de meses NÃO fechados (lock próprio: stocks.years),
          // para que o valor EUR de meses fechados fique congelado.
          const stockYears = prev.stocks?.years || {}
          const freezeHolding = (h) => {
            const currency = h.currency || 'EUR'
            if (currency === 'EUR' || !h.monthData) return h
            const rate = next[currency] || 1.0
            const newMonthData = { ...h.monthData }
            for (const mk of Object.keys(newMonthData)) {
              const [y, m] = mk.split('-').map(Number)
              const isLocked = (stockYears[y]?.lockedMonths || []).includes(m)
              if (!isLocked) {
                newMonthData[mk] = { ...newMonthData[mk], rateToEUR: rate }
              }
            }
            return { ...h, monthData: newMonthData }
          }
          const newStocks = prev.stocks ? {
            ...prev.stocks,
            acoes: { ...(prev.stocks.acoes || {}), holdings: (prev.stocks.acoes?.holdings || []).map(freezeHolding) },
            etfs:  { ...(prev.stocks.etfs  || {}), holdings: (prev.stocks.etfs?.holdings  || []).map(freezeHolding) },
          } : prev.stocks

          return { ...prev, banks: { ...(prev.banks || {}), platforms: newPlatforms }, stocks: newStocks }
        })
      })
      .catch(err => {
        if (cancelled) return
        if (!silent) toastBus.emit('Sem ligação — taxas de câmbio não atualizadas.')
        if (isElectron) window.api?.logError({ type: 'network', source: 'exchange-rates', message: String(err) })
      })
    }

    load(false)
    const iv = setInterval(() => load(true), RATES_REFRESH_MS)
    return () => { cancelled = true; clearInterval(iv) }
  // Propositadamente só ao montar — setData deve ser estável (useState dispatch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { rates, updatedAt }
}
