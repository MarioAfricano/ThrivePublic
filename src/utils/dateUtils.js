// ── Helpers de datas e month-keys ─────────────────────────────
//
// Convenções:
//   - `mk` (month-key) = "YYYY-M" com M em 0-indexed (ex: "2026-3" = Abril 2026).
//   - `input[type=month]` em HTML usa "YYYY-MM" com MM em 1-indexed (ex: "2026-04").
//
// Este ficheiro é a fonte única para conversões e comparações. Se precisares
// de uma variante, adiciona-a aqui em vez de reimplementar na página.

// Constrói um mk a partir de ano e mês (0-indexed)
export function getMK(year, month) { return `${year}-${month}` }

// Converte mk em número comparável (ex: "2026-3" → 202603). 1-indexed no resultado.
export function mkToNum(mk) {
  if (!mk) return 0
  const [y, m] = mk.split('-').map(Number)
  return y * 100 + m
}

// Compara dois mks. Devolve <0, 0, >0.
export function compareMK(a, b) {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return ya !== yb ? ya - yb : ma - mb
}

// mk → "YYYY-MM" (para <input type="month">), passa a 1-indexed
export function mkToMonthInput(mk) {
  if (!mk) return ''
  const [y, m] = mk.split('-').map(Number)
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

// "YYYY-MM" de <input type="month"> → mk (0-indexed)
export function monthInputToMk(val) {
  if (!val) return null
  const [y, m] = val.split('-').map(Number)
  return getMK(y, m - 1)
}

// Aliases semânticos para a conversão 0-indexed ↔ <input type="month"> (4.10)
export const mkToHtmlMonth  = mkToMonthInput   // mk       → "YYYY-MM" (1-indexed)
export const htmlMonthToMk  = monthInputToMk   // "YYYY-MM" → mk (0-indexed)

// Adiciona N meses a um mk. (suporta N negativo)
export function addMonthsToMk(mk, n) {
  if (!mk) return mk
  const [y, m] = mk.split('-').map(Number)
  const total = y * 12 + m + n
  return getMK(Math.floor(total / 12), ((total % 12) + 12) % 12)
}

// Adiciona N meses a uma data ISO "YYYY-MM-DD" (string → string).
// Trata overflow: 31/Jan + 1 mês = 28/Fev (ou 29 em anos bissextos).
export function addMonthsToDate(dateStr, months) {
  const d = new Date(dateStr)
  const targetMonth = d.getMonth() + months
  d.setDate(1)
  d.setMonth(targetMonth)
  // Mantém o dia original se couber no mês resultante
  const original = new Date(dateStr).getDate()
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(original, daysInTarget))
  return d.toISOString().slice(0, 10)
}
