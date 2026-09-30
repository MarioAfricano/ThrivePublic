import { useState, useRef, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  CATEGORY_IDS, CATEGORY_LABELS, CATEGORY_DEFAULT_COLORS,
  getCategoryColors, isValidCategoryColor,
} from '../../data/categories.js'

// ── Cores das categorias (Definições → Aparência) ────────────────
// Uma linha por categoria com um <input type="color"> nativo. O valor
// vive em `data.categoryColors` e propaga-se a tudo o que desenha
// categorias: Evolução Mensal, Composição Mensal, donut de Alocação e
// a lista de categorias do Dashboard.
//
// Só as categorias alteradas são guardadas; repor apaga a entrada em vez
// de gravar o default, para que uma futura mudança de paleta por omissão
// chegue a quem nunca personalizou.
// A gravacao e adiada: <input type="color"> dispara onChange a cada
// movimento dentro do selector, e gravar em cada um enchia o historico de
// undo e martelava o disco. O rascunho local da feedback imediato.
const COMMIT_DELAY_MS = 350

export default function CategoryColors() {
  const { data, saveData } = useApp()
  const colors = getCategoryColors(data)
  const custom = data?.categoryColors || {}
  const anyCustom = CATEGORY_IDS.some(id => isValidCategoryColor(custom[id]))

  const [draft, setDraft] = useState({})
  // UM temporizador para todas as cores, com as alteracoes por gravar
  // acumuladas num ref. Com um temporizador por cor, dois saveData
  // seguidos partiam ambos do mesmo `data` desta closure e o segundo
  // desfazia o primeiro — a cor mexida antes perdia-se.
  const pending = useRef({})
  const timer   = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function setColor(id, value) {
    if (!isValidCategoryColor(value)) return
    pending.current = { ...pending.current, [id]: value }
    setDraft(d => ({ ...d, [id]: value }))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const changes = pending.current
      pending.current = {}
      saveData({ categoryColors: { ...custom, ...changes } })
      setDraft({})
    }, COMMIT_DELAY_MS)
  }

  function resetOne(id) {
    clearTimeout(timer.current)
    const changes = pending.current
    pending.current = {}
    setDraft({})
    // Aplica o que estivesse por gravar e remove so esta categoria.
    const next = { ...custom, ...changes }
    delete next[id]
    saveData({ categoryColors: next })
  }

  function resetAll() {
    clearTimeout(timer.current)
    pending.current = {}
    setDraft({})
    saveData({ categoryColors: {} })
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
          Cores das categorias
        </h3>
        {anyCustom && (
          <button type="button" onClick={resetAll}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-secondary)', fontSize: '0.66rem', padding: '2px 8px', cursor: 'pointer',
            }}>
            <RotateCcw size={10} aria-hidden="true" /> Repor todas
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 8,
      }}>
        {CATEGORY_IDS.map(id => {
          const isCustom = isValidCategoryColor(custom[id]) || draft[id] != null
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 10px',
            }}>
              <input
                type="color"
                id={`cat-color-${id}`}
                value={draft[id] ?? colors[id]}
                onChange={e => setColor(id, e.target.value)}
                style={{
                  width: 26, height: 26, padding: 0, flexShrink: 0,
                  background: 'none', border: '1px solid var(--wa-15)',
                  borderRadius: 6, cursor: 'pointer',
                }}
              />
              <label htmlFor={`cat-color-${id}`}
                style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: 'auto', cursor: 'pointer' }}>
                {CATEGORY_LABELS[id]}
              </label>
              {isCustom && (
                <button type="button" onClick={() => resetOne(id)}
                  aria-label={`Repor cor de ${CATEGORY_LABELS[id]}`}
                  title={`Repor para ${CATEGORY_DEFAULT_COLORS[id]}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                  <RotateCcw size={11} aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 8 }}>
        Aplica-se à Evolução Mensal, Composição Mensal, Alocação e à lista de
        categorias. Guardado com os teus dados, não neste dispositivo.
      </p>
    </div>
  )
}
