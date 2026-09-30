/**
 * Card — container com fundo, borda e sombra padrão da app.
 *
 * Props
 * ─────
 *   padding  — padding interno (default: 20). Pode ser número ou string CSS.
 *   header   — elemento React no topo (título, ações, etc.).
 *   noBorder — remove a borda (útil para nested cards).
 *   style    — override de estilos do container.
 *   children
 */
export function Card({ padding = 20, header, noBorder = false, style, children }) {
  return (
    <div
      className={noBorder ? undefined : 'card'}
      style={{
        ...(noBorder ? {
          background:   'var(--bg-card)',
          borderRadius: 'var(--radius)',
        } : undefined),
        padding,
        ...style,
      }}
    >
      {header && (
        <div style={{ marginBottom: 16 }}>
          {header}
        </div>
      )}
      {children}
    </div>
  )
}

export default Card
