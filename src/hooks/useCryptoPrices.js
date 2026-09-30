import { useState, useCallback } from 'react'
import { fetchWithRetry } from '../utils/apiClient.js'
import { toastBus } from '../utils/toastBus.js'

// ── Hook: preços cripto via CoinGecko ─────────────────────────────
// Actualiza `h.price` para holdings do mês actual **não-lockado**.
// Invariantes:
//   - Silencioso: não gera histórico nem snapshot — só escreve price.
//   - Se o mês actual (`data.currentMonth`) está em `crypto.years[y].lockedMonths`,
//     a holding é ignorada (preserva preço congelado).
//   - Persiste directamente via IPC / localStorage para não disparar o fluxo
//     normal de `saveData` (que adicionaria entrada no histórico).
//   - Em Electron usa `window.api.fetchCryptoPrices(ids)`; senão fetch directo
//     com `AbortSignal.timeout(8000)`.
//
// Uso:
//   const { fetchCryptoPrices, cryptoPricesLoading } =
//     useCryptoPrices({ dataRef, configRef, setData })

const isElectron = typeof window !== 'undefined' && !!window.api

// CoinGecko: mapeamento ticker → ID
export const COINGECKO_IDS = {
  BTC:'bitcoin',ETH:'ethereum',SOL:'solana',XRP:'ripple',BNB:'binancecoin',
  ADA:'cardano',DOGE:'dogecoin',DOT:'polkadot',AVAX:'avalanche-2',LINK:'chainlink',
  UNI:'uniswap',MATIC:'matic-network',LTC:'litecoin',BCH:'bitcoin-cash',ATOM:'cosmos',
  XLM:'stellar',VET:'vechain',FIL:'filecoin',TRX:'tron',ETC:'ethereum-classic',
  NEAR:'near',ALGO:'algorand',HBAR:'hedera-hashgraph',SHIB:'shiba-inu',
  SAND:'the-sandbox',MANA:'decentraland',CRO:'crypto-com-chain',FTM:'fantom',
  ONE:'harmony',THETA:'theta-token',ICP:'internet-computer',FLOW:'flow',
  APT:'aptos',SUI:'sui',OP:'optimism',ARB:'arbitrum',PEPE:'pepe',
  WIF:'dogwifcoin',BONK:'bonk',FLOKI:'floki',TON:'the-open-network',
}

export function useCryptoPrices({ dataRef, configRef, setData }) {
  const [cryptoPricesLoading, setLoading] = useState(false)

  // `silent`: refresh de fundo (intervalo periódico) — sem toasts de erro,
  // para não incomodar quando a máquina está offline; erros vão só ao log.
  const fetchCryptoPrices = useCallback(async (baseData, { silent = false } = {}) => {
    const d = baseData || dataRef.current
    if (!d?.crypto?.platforms?.length) return
    const platforms = d.crypto.platforms
    const tickers = [...new Set(
      platforms.flatMap(p => (p.holdings || []).map(h => h.ticker?.toUpperCase())).filter(Boolean)
    )]
    if (!tickers.length) return
    const ids = tickers.map(t => COINGECKO_IDS[t]).filter(Boolean)
    if (!ids.length) return
    setLoading(true)
    try {
      const json = (isElectron && window.api?.fetchCryptoPrices)
        ? await window.api.fetchCryptoPrices(ids)
        : await fetchWithRetry(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=eur`,
            { timeout: 8000 }
          )
      if (!json || typeof json !== 'object') {
        if (!silent) toastBus.emit('Sem ligação — preços cripto não atualizados.')
        if (isElectron) window.api?.logError({ type: 'network', source: 'crypto-prices', message: 'IPC returned null/invalid' })
        return
      }
      const priceMap = {}
      for (const t of tickers) {
        const geckoId = COINGECKO_IDS[t]
        if (geckoId && json[geckoId]?.eur != null) priceMap[t] = json[geckoId].eur
      }
      if (!Object.keys(priceMap).length) return
      setData(prev => {
        if (!prev?.crypto?.platforms) return prev
        const year  = prev.currentYear
        const month = prev.currentMonth
        const locked = prev.crypto.years?.[year]?.lockedMonths || []
        const newPlatforms = prev.crypto.platforms.map(p => ({
          ...p,
          holdings: p.holdings.map(h => {
            // Não actualiza se o mês actual está fechado
            if (locked.includes(month)) return h
            const price = priceMap[h.ticker?.toUpperCase()]
            if (price == null) return h
            return { ...h, price }
          }),
        }))
        const newState = { ...prev, crypto: { ...prev.crypto, platforms: newPlatforms } }
        // Persiste silenciosamente (sem snapshot/histórico)
        if (isElectron && configRef.current?.dataPath) {
          window.api.writeData('data.json', newState)
            .then(ok => { if (!ok) toastBus.emit('Erro ao guardar no disco — preços cripto não persistidos.') })
            .catch(() => toastBus.emit('Erro ao guardar no disco — preços cripto não persistidos.'))
        } else {
          try { localStorage.setItem('thrive-dev-data', JSON.stringify(newState)) } catch { /* storage cheio */ }
        }
        return newState
      })
    } catch (err) {
      if (!silent) toastBus.emit('Sem ligação — preços cripto não atualizados.')
      if (isElectron) window.api?.logError({ type: 'network', source: 'crypto-prices', message: String(err) })
    } finally {
      setLoading(false)
    }
  }, [dataRef, configRef, setData])

  return { fetchCryptoPrices, cryptoPricesLoading }
}
