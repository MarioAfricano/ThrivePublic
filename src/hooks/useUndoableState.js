import { useState, useRef, useCallback } from 'react'

// ── Hook: histórico de alterações com undo ────────────────────────
// Abstrai o slice `history` + `historyRef` + `undoLast` + `undoTo` que
// vivia em App.jsx. Invariantes:
//   - Cada entry: { id, timestamp, label, data }.
//   - `pushSnapshot(label, snapshot)` adiciona uma entry ao fim, cortando
//     a janela a **50 entradas** (`slice(-49)` antes de concatenar).
//   - `undoLast()` restaura a última entry e remove-a.
//   - `undoTo(id)` restaura o estado **antes** da entry `id` e remove essa
//     entry + todas as posteriores.
//   - Qualquer acção chama `onRestore(restoredData, reasonLabel)` para que
//     o chamador propague a mudança (setData, setIsDirty, persist, ...).
//   - Se `onRestore` é omitido, o hook limita-se a gerir a janela (fluxo de
//     "só adicionar"). Útil em testes.
//
// Uso:
//   const { history, historyRef, pushSnapshot, undoLast, undoTo } =
//     useUndoableState({
//       onRestore: (state, reason) => { setData(state); setIsDirty(true); persist(state, reason) },
//     })

export function useUndoableState({ onRestore, initialHistory } = {}) {
  const [history, setHistory] = useState(initialHistory || [])
  const historyRef = useRef([])
  historyRef.current = history // eslint-disable-line react-hooks/refs

  const restoreHistory = useCallback((entries) => {
    setHistory(entries)
  }, [])

  const pushSnapshot = useCallback((label, snapshot) => {
    if (!label) return
    setHistory(prev => [
      ...prev.slice(-49),
      { id: Date.now(), timestamp: new Date().toISOString(), label, data: snapshot },
    ])
  }, [])

  const undoLast = useCallback(() => {
    const h = historyRef.current
    if (!h.length) return
    const last = h[h.length - 1]
    setHistory(prev => prev.slice(0, -1))
    onRestore?.(last.data, `Undo: ${last.label}`)
  }, [onRestore])

  const undoTo = useCallback((id) => {
    const h = historyRef.current
    const idx = h.findIndex(e => e.id === id)
    if (idx < 0) return
    const entry = h[idx]
    setHistory(prev => prev.slice(0, idx))
    onRestore?.(entry.data, `Reverter para antes de: ${entry.label}`)
  }, [onRestore])

  return { history, historyRef, pushSnapshot, undoLast, undoTo, restoreHistory }
}
