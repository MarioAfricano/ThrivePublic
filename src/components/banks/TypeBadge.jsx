import { ACCOUNT_TYPES } from './constants.js'

// ── Badge tipo de conta ────────────────────────────────────────
// Pastilha colorida com o label do tipo (Conta / Poupança / P. c/ Desconto).
export default function TypeBadge({ type }) {
  const t = ACCOUNT_TYPES[type] || ACCOUNT_TYPES.conta
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99,
      background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}30`, whiteSpace: 'nowrap' }}>
      {t.label}
    </span>
  )
}
