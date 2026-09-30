// ── Hook: dados históricos de benchmarks (SPY, PSI20.LS) ──────────
// Usa o mesmo IPC fetchStockHistory que a página de Ações.
// Retorna preços mensais e helpers para calcular retornos normalizados.

import { useState, useEffect, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && !!window.api

function findPriceAtMK(points, year, month) {
  if (!points?.length) return null
  const exact = points.find(p => p.year === year && p.month === month)
  if (exact) return exact.price
  const before = points.filter(p => p.year < year || (p.year === year && p.month < month))
  return before.length > 0 ? before.at(-1).price : null
}

export function useBenchmarks() {
  const [spyData,   setSpyData]   = useState(null)
  const [psi20Data, setPsi20Data] = useState(null)
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    if (!isElectron || !window.api?.fetchStockHistory) return
    let cancelled = false
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    Promise.allSettled([
      window.api.fetchStockHistory('SPY'),
      window.api.fetchStockHistory('PSI20.LS'),
    ]).then(([spyR, psi20R]) => {
      if (cancelled) return
      if (spyR.status   === 'fulfilled' && spyR.value?.points?.length)   setSpyData(spyR.value)
      if (psi20R.status === 'fulfilled' && psi20R.value?.points?.length) setPsi20Data(psi20R.value)
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  /**
   * Retorno percentual de um benchmark entre refMK e currentMK.
   * Devolve null se não houver dados suficientes.
   */
  const getReturn = useCallback((histData, refMK, currentMK) => {
    if (!histData?.points || !refMK || !currentMK) return null
    const [ry, rm] = refMK.split('-').map(Number)
    const [cy, cm] = currentMK.split('-').map(Number)
    const refPrice = findPriceAtMK(histData.points, ry, rm)
    const curPrice = findPriceAtMK(histData.points, cy, cm)
    if (!refPrice || !curPrice) return null
    return (curPrice - refPrice) / refPrice
  }, [])

  /**
   * Valores mensais normalizados para o ano dado, indexados a refValue no refMK.
   * Útil para sobrepor ao gráfico de área do Dashboard.
   * Devolve array de { month: 0-11, value: number }.
   */
  const getMonthlyNormalized = useCallback((histData, refMK, refValue, year) => {
    if (!histData?.points || !refMK || !refValue) return []
    const [ry, rm] = refMK.split('-').map(Number)
    const refPrice  = findPriceAtMK(histData.points, ry, rm)
    if (!refPrice) return []
    const result = []
    for (let m = 0; m < 12; m++) {
      const price = findPriceAtMK(histData.points, year, m)
      if (price != null) result.push({ month: m, value: refValue * (price / refPrice) })
    }
    return result
  }, [])

  return { spyData, psi20Data, loading, getReturn, getMonthlyNormalized }
}
