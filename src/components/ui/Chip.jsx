/**
 * Chip — pastilha/tag compacta (ex: "EUR", "Ativo", "IRS").
 *
 * Props
 * ─────
 *   color    — 'accent' | 'green' | 'red' | 'yellow' | 'blue' | 'muted'  (default: 'muted')
 *   size     — 'sm' | 'md'  (default: 'sm')
 *   dot      — mostra um ponto colorido antes do label.
 *   style    — override de estilos.
 *   children — conteúdo da pastilha.
 */

const COLOR_MAP = {
  accent: { bg: 'var(--accent-dim)',             color: 'var(--accent)'          },
  green:  { bg: 'var(--green-dim)',              color: 'var(--green)'           },
  red:    { bg: 'var(--red-dim)',                color: 'var(--red)'             },
  yellow: { bg: 'rgba(251,191,36,0.12)',         color: 'var(--yellow)'          },
  blue:   { bg: 'rgba(96,165,250,0.1)',          color: 'var(--blue)'            },
  muted:  { bg: 'var(--wa-05)',        color: 'var(--text-secondary)'  },
}

const SIZE_MAP = {
  sm: { fontSize: '0.7rem',  padding: '2px 8px',  borderRadius: 6  },
  md: { fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99 },
}

export function Chip({ color = 'muted', size = 'sm', dot = false, style, children }) {
  const c = COLOR_MAP[color] || COLOR_MAP.muted
  const s = SIZE_MAP[size]   || SIZE_MAP.sm

  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      gap:            4,
      fontSize:       s.fontSize,
      fontWeight:     600,
      padding:        s.padding,
      borderRadius:   s.borderRadius,
      background:     c.bg,
      color:          c.color,
      whiteSpace:     'nowrap',
      ...style,
    }}>
      {dot && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      )}
      {children}
    </span>
  )
}

export default Chip
