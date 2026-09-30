import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Pencil, Check } from 'lucide-react'
import { formatEuro } from '../../data/initialData.js'

/**
 * EditableField — componente unificado para edição inline.
 *
 * Substitui as variações EditVal / EditText / EditableName / EditTaxRate
 * espalhadas por Acoes, Banks, PPR, Aforro, Crypto, Carteira, Dividas.
 *
 * Props
 * ─────
 *   value        — valor actual (número, string ou null/undefined).
 *   onSave(v)    — callback ao confirmar (Enter/blur/Tab/botão ✓).
 *   type         — 'number' | 'text' | 'currency' | 'percent'
 *                  • currency → formatter default = formatEuro
 *                  • percent  → input em % (ex.: 28), valor guardado como fracção (0.28)
 *                  • number   → parsefloat, sem formatador default
 *                  • text     → string tal e qual
 *   locked       — só-leitura (sem caneta, sem borda dashed, cursor default).
 *   formatter    — função (value) => string; sobrepõe o default do type.
 *   placeholder  — mostrado (em itálico, cinza) quando value é null/''.
 *   size         — preset 'lg' | 'md' | 'sm' | 'xs' (controla fontSize + width + ícones).
 *   width        — override numérico do width do input.
 *   fontSize     — override string do font-size.
 *   fontWeight   — override numérico do font-weight.
 *   color        — override da cor de display (CSS string).
 *   showPencil   — mostrar ícone de lápis (default true quando não locked).
 *   onTab        — callback ao premir Tab (commita e avança foco).
 *   title        — tooltip. Default: 'Clica para editar'.
 *   ref          — expõe { startEdit() } para abrir programaticamente.
 */
const SIZE_PRESETS = {
  lg: { fs: '1.3rem',  w: 120, iconCheck: 13, iconPencil: 9 },
  md: { fs: '0.95rem', w: 100, iconCheck: 13, iconPencil: 9 },
  sm: { fs: '0.8rem',  w: 80,  iconCheck: 11, iconPencil: 8 },
  xs: { fs: '0.7rem',  w: 65,  iconCheck: 10, iconPencil: 8 },
}

function defaultFormat(type, value) {
  if (type === 'currency') return formatEuro(value)           // trata null → '—'
  if (type === 'percent')  return value == null ? '—' : `${(Number(value) * 100).toFixed(0)}%`
  if (type === 'text')     return String(value ?? '')
  // type === 'number'
  return value == null || value === '' ? '' : String(value)
}

function parseInput(type, draft) {
  const raw = String(draft ?? '')
  if (type === 'text') return raw
  const n = parseFloat(raw.replace(',', '.'))
  if (isNaN(n)) return undefined
  if (type === 'percent') return n / 100
  return n
}

function initialDraft(type, value) {
  if (value == null || value === '') return ''
  // Preserva decimais no draft (0.025 → "2.5"), sem ruído de float (→ toFixed(4))
  if (type === 'percent') return String(parseFloat((Number(value) * 100).toFixed(4)))
  return String(value)
}

export const EditableField = forwardRef(function EditableField({
  value,
  onSave,
  type = 'number',
  locked = false,
  formatter,
  placeholder,
  size = 'md',
  width,
  fontSize,
  fontWeight,
  color,
  showPencil = true,
  onTab,
  title,
  ariaLabel,
}, ref) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  useImperativeHandle(ref, () => ({
    startEdit() {
      if (locked) return
      setDraft(initialDraft(type, value))
      setEditing(true)
    },
  }), [locked, type, value])

  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.md
  const fs = fontSize ?? preset.fs
  const w  = width    ?? preset.w
  const fw = fontWeight ?? (type === 'text' ? 500 : 700)
  const baseColor = color ?? (type === 'text' ? 'var(--text-secondary)' : 'var(--text)')

  const isEmpty   = value == null || value === ''
  const formatted = formatter ? formatter(value) : defaultFormat(type, value)
  const numeric   = type !== 'text'

  // ── Modo só-leitura ────────────────────────────────────────────
  if (locked) {
    const lockedColor = color ?? 'var(--text-secondary)'
    return (
      <span style={{
        fontSize: fs,
        fontWeight: fw,
        color: lockedColor,
        fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
      }}>
        {isEmpty ? (placeholder || '—') : formatted}
      </span>
    )
  }

  function commit() {
    const parsed = parseInput(type, draft)
    const mainEl = document.getElementById('main-scroll')
    const savedScroll = mainEl?.scrollTop ?? 0
    if (parsed !== undefined) onSave(parsed)
    setEditing(false)
    if (mainEl) requestAnimationFrame(() => requestAnimationFrame(() => { mainEl.scrollTop = savedScroll }))
  }

  function cancel() { setEditing(false) }

  function handleKey(e) {
    if (e.key === 'Enter')  { commit(); return }
    if (e.key === 'Escape') { cancel(); return }
    if (e.key === 'Tab' && onTab) { e.preventDefault(); commit(); onTab() }
  }

  // ── Modo edição ────────────────────────────────────────────────
  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <input
          ref={inputRef}
          value={draft}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          type="text"
          inputMode={numeric || type === 'percent' ? 'decimal' : 'text'}
          autoComplete="off"
          spellCheck={false}
          aria-label={ariaLabel}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent)',
            borderRadius: 5,
            color: 'var(--text)',
            fontSize: fs,
            fontWeight: fw,
            width: w,
            padding: '2px 6px',
            fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
          }}
        />
        {type === 'percent' ? (
          <span style={{ fontSize: fs, color: 'var(--text-muted)' }}>%</span>
        ) : (
          <button
            type="button"
            onClick={commit}
            aria-label={ariaLabel ? `Guardar ${ariaLabel}` : 'Guardar'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'flex' }}>
            <Check size={preset.iconCheck} aria-hidden="true" />
          </button>
        )}
      </span>
    )
  }

  // ── Modo display ───────────────────────────────────────────────
  const showingPlaceholder = isEmpty && placeholder
  const displayColor = showingPlaceholder ? 'var(--text-muted)' : baseColor

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => { setDraft(initialDraft(type, value)); setEditing(true) }}
      title={title ?? 'Clica para editar'}
      aria-label={ariaLabel ? `${ariaLabel}: ${formatted}. Clica para editar.` : undefined}
      style={{
        cursor: locked ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        background: 'none',
        padding: 0,
        border: 'none',
        color: displayColor,
        font: 'inherit',
        fontSize: fs,
        fontWeight: fw,
        fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
        borderBottom: locked ? '1px dashed transparent' : '1px dashed var(--wa-13)',
      }}
      onMouseEnter={e => { if (!locked) e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
      onMouseLeave={e => { if (!locked) e.currentTarget.style.borderBottomColor = 'var(--wa-13)' }}>
      {showingPlaceholder
        ? <span style={{ fontStyle: 'italic', fontWeight: 400 }}>{placeholder}</span>
        : formatted}
      {showPencil && !locked && <Pencil size={preset.iconPencil} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </button>
  )
})

export default EditableField
