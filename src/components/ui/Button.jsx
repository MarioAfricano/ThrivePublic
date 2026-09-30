import { Loader2 } from 'lucide-react'

/**
 * Button — botão unificado com variantes e tamanhos.
 *
 * Props
 * ─────
 *   variant  — 'primary' | 'ghost' | 'danger'  (default: 'ghost')
 *   size     — 'sm' | 'md' | 'lg'              (default: 'md')
 *   loading  — mostra spinner e desactiva o botão.
 *   icon     — elemento React antes do label (ex: <Plus size={14} />).
 *   iconEnd  — elemento React depois do label.
 *   fullWidth — largura 100%.
 *   type     — 'button' (default) | 'submit' | 'reset'.
 *   disabled, onClick, children — passados ao <button>.
 */

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg,#818cf8,#6366f1)',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'rgba(248,113,113,0.1)',
    color: 'var(--red)',
    border: '1px solid rgba(248,113,113,0.2)',
  },
}

const SIZES = {
  sm: { padding: '5px 10px',  fontSize: '0.75rem',  borderRadius: 7,  gap: 5  },
  md: { padding: '8px 14px',  fontSize: '0.875rem', borderRadius: 8,  gap: 6  },
  lg: { padding: '10px 18px', fontSize: '0.9375rem',borderRadius: 10, gap: 7  },
}

export function Button({
  variant  = 'ghost',
  size     = 'md',
  loading  = false,
  icon,
  iconEnd,
  fullWidth = false,
  disabled,
  children,
  style,
  type = 'button',
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.ghost
  const s = SIZES[size]       || SIZES.md
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            s.gap,
        padding:        s.padding,
        fontSize:       s.fontSize,
        fontWeight:     600,
        borderRadius:   s.borderRadius,
        cursor:         isDisabled ? 'not-allowed' : 'pointer',
        opacity:        isDisabled ? 0.5 : 1,
        transition:     'opacity 0.15s, background 0.15s',
        whiteSpace:     'nowrap',
        width:          fullWidth ? '100%' : undefined,
        ...v,
        ...style,
      }}
      {...rest}
    >
      {loading
        ? <Loader2 size={13} aria-hidden="true" style={{ animation: 'spinIcon 0.8s linear infinite' }} />
        : icon}
      {children}
      {!loading && iconEnd}
    </button>
  )
}

export default Button
