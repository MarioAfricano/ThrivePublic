/**
 * Input — campo de texto/número com label, erro e disabled.
 *
 * Props
 * ─────
 *   label       — texto acima do campo.
 *   error       — mensagem de erro (mostra borda vermelha + texto).
 *   hint        — texto de ajuda abaixo do campo (quando sem erro).
 *   type        — 'text' | 'number' | 'password' | 'email' | 'color' | ...
 *   disabled    — campo bloqueado.
 *   fullWidth   — largura 100% (default: true).
 *   inputStyle  — override de estilos do <input>.
 *   Restantes   — passados ao <input> (value, onChange, placeholder, etc.)
 */
export function Input({
  label,
  error,
  hint,
  type = 'text',
  disabled = false,
  fullWidth = true,
  inputStyle,
  style,
  ...rest
}) {
  const borderColor = error
    ? 'rgba(248,113,113,0.6)'
    : 'var(--border)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: fullWidth ? '100%' : undefined, ...style }}>
      {label && (
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <input
        type={type}
        disabled={disabled}
        style={{
          width:        '100%',
          background:   'var(--bg-elevated)',
          border:       `1px solid ${borderColor}`,
          borderRadius: 8,
          color:        'var(--text)',
          padding:      '8px 12px',
          fontSize:     '0.875rem',
          outline:      'none',
          opacity:      disabled ? 0.5 : 1,
          cursor:       disabled ? 'not-allowed' : 'text',
          transition:   'border-color 0.15s',
          ...inputStyle,
        }}
        onFocus={e => { if (!error) e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e  => { e.target.style.borderColor = borderColor }}
        {...rest}
      />
      {error && (
        <span style={{ fontSize: '0.72rem', color: 'var(--red)' }}>{error}</span>
      )}
      {!error && hint && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</span>
      )}
    </div>
  )
}

export default Input
