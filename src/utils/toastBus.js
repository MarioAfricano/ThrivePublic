// ── Toast bus ─────────────────────────────────────────────────────────────
// Pub/sub mínimo para toasts globais sem React Context.
// Qualquer módulo pode emitir; NetworkToast subscreve em App.jsx.
//
// Uso:
//   import { toastBus } from '../utils/toastBus.js'
//   toastBus.emit('Sem ligação — dados não atualizados.')
//
//   // subscrever (devolve função de unsubscribe):
//   const unsub = toastBus.subscribe(msg => setMsg(msg))
//   return () => unsub()

const _listeners = new Set()

// Debounce por mensagem: não repete a mesma mensagem dentro de 30s
const _lastEmit  = new Map()
const DEBOUNCE   = 30_000

export const toastBus = {
  /** @param {string} msg */
  emit(msg) {
    const now = Date.now()
    if (_lastEmit.has(msg) && now - _lastEmit.get(msg) < DEBOUNCE) return
    _lastEmit.set(msg, now)
    _listeners.forEach(fn => fn(msg))
  },

  /**
   * @param {(msg: string) => void} fn
   * @returns {() => void} unsub
   */
  subscribe(fn) {
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  },
}
