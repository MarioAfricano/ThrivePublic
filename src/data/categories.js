// ── Categorias de património — fonte única de verdade ──────────────
//
// Antes as cores viviam em dois sítios que já divergiam: `CAT_DEFS` em
// components/dashboard/constants.js (ordem de pilhagem do gráfico de
// composição) e um array inline no Dashboard (ordem de apresentação).
// Este módulo passa a ser o único dono de ids, rótulos e cores.
//
// As cores podem ser personalizadas pelo utilizador em
// Definições → Aparência; os valores escolhidos ficam em
// `data.categoryColors` como { [id]: '#rrggbb' }. Só os ids conhecidos
// são respeitados, e uma cor em falta cai para o default.
//
// Módulo puro — nada de I/O nem React.

/** Cores por omissão de cada categoria. */
export const CATEGORY_DEFAULT_COLORS = {
  poupanca: '#818cf8',
  aforro:   '#60a5fa',
  acoes:    '#4ade80',
  etfs:     '#22d3ee',
  ppr:      '#f472b6',
  banco:    '#fbbf24',
  crypto:   '#f97316',
}

/** Rótulos legíveis. */
export const CATEGORY_LABELS = {
  poupanca: 'Poupança',
  aforro:   'Aforro',
  acoes:    'Ações',
  etfs:     'ETFs',
  ppr:      'PPR',
  banco:    'Banco',
  crypto:   'Criptomoeda',
}

/** Ordem de apresentação (Dashboard: KPIs, lista de categorias, donut). */
export const CATEGORY_IDS = ['poupanca', 'aforro', 'acoes', 'etfs', 'ppr', 'banco', 'crypto']

/**
 * Ordem de pilhagem do gráfico de composição — de baixo para cima.
 * Diferente da ordem de apresentação de propósito: agrupa por liquidez.
 */
export const CATEGORY_STACK_IDS = ['banco', 'poupanca', 'aforro', 'ppr', 'acoes', 'etfs', 'crypto']

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Uma cor só conta se for hex de 6 dígitos; caso contrário usa-se o default. */
export function isValidCategoryColor(value) {
  return typeof value === 'string' && HEX_RE.test(value)
}

/**
 * Mapa completo { id: cor } com as personalizações do utilizador por cima
 * dos defaults. Entradas inválidas ou de ids desconhecidos são ignoradas.
 */
export function getCategoryColors(data) {
  const custom = data?.categoryColors || {}
  const out = { ...CATEGORY_DEFAULT_COLORS }
  for (const id of CATEGORY_IDS) {
    if (isValidCategoryColor(custom[id])) out[id] = custom[id]
  }
  return out
}

/** Cor de uma categoria (com personalização aplicada). */
export function getCategoryColor(data, id) {
  return getCategoryColors(data)[id]
}

/**
 * Definições prontas a consumir, numa dada ordem.
 * `order` default é a ordem de apresentação.
 */
export function getCategoryDefs(data, order = CATEGORY_IDS) {
  const colors = getCategoryColors(data)
  return order.map(id => ({ id, key: id, label: CATEGORY_LABELS[id], color: colors[id] }))
}
