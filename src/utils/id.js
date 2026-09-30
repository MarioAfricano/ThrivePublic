// Gera um identificador único curto. Usa crypto.randomUUID quando disponível,
// com fallback para ambientes antigos.
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
