// ── Hook: taxas de inflação HICP Portugal (Eurostat) ─────────────
// Carrega a cache local (inflation.json / localStorage) e re-fetcha
// se os dados tiverem mais de 24 h. Sem impacto no histórico de undo
// — gere o seu próprio ficheiro de cache, separado do data.json.

import { useState, useEffect } from 'react'

const isElectron = typeof window !== 'undefined' && !!window.api
const INFLATION_TTL = 24 * 60 * 60 * 1000  // 24 h

export function useInflation() {
  const [rates,   setRates]   = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1. Carregar cache local
      let cached
      if (isElectron) {
        cached = await window.api.readData('inflation.json').catch(() => null)
      } else {
        try { cached = JSON.parse(localStorage.getItem('thrive-inflation') || 'null') } catch (e) { cached = null } // eslint-disable-line no-unused-vars
      }
      if (cached?.rates && !cancelled) setRates(cached.rates)

      // 2. Re-fetch se stale
      const age = Date.now() - (cached?.lastFetched || 0)
      if (age < INFLATION_TTL) return
      if (!isElectron || !window.api?.fetchInflation) return

      setLoading(true)
      try {
        const fresh = await window.api.fetchInflation()
        if (fresh && Object.keys(fresh).length > 0 && !cancelled) {
          setRates(fresh)
          window.api.writeData('inflation.json', { rates: fresh, lastFetched: Date.now() }).catch(() => { /* cache write failure is silent */ })
        }
      } catch (e) { /* network failure is silent */ } // eslint-disable-line no-unused-vars
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { rates, loading }
}
