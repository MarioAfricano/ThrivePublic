// ── API Client ────────────────────────────────────────────────────────────
// fetchWithRetry: fetch com timeout (AbortController) + retry com backoff
// exponencial. Apenas para o renderer (browser / Electron renderer process).
// O main process usa httpsGetJson (electron/main.cjs).
//
// Uso:
//   import { fetchWithRetry } from '../utils/apiClient.js'
//   const json = await fetchWithRetry(url, { retries: 2, timeout: 10000 })
//
// Lança em falha definitiva — o chamador decide o que fazer (toast, log, etc.)

/**
 * @param {string} url
 * @param {{ retries?: number, timeout?: number, backoff?: number }} [opts]
 *   retries  — tentativas extra após a primeira (default 2 → até 3 tentativas)
 *   timeout  — ms antes de abortar cada tentativa (default 10 000)
 *   backoff  — ms base para backoff exponencial (default 800 → 800ms, 1600ms…)
 * @returns {Promise<unknown>}  JSON parseado; lança em falha definitiva
 */
export async function fetchWithRetry(url, { retries = 2, timeout = 10000, backoff = 800 } = {}) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      if (i < retries) await _sleep(backoff * 2 ** i)  // 800 ms, 1600 ms, …
    }
  }
  throw lastErr
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
