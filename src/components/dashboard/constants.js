// ── Constantes do Dashboard ────────────────────────────────────
// As categorias (ids, rotulos e cores) vivem em src/data/categories.js.
// `CAT_DEFS` fica aqui so como a ordem de pilhagem com as cores POR
// OMISSAO — componentes que precisem das cores personalizadas devem usar
// getCategoryDefs(data, CATEGORY_STACK_IDS).
// DEBT_COLORS e a paleta ciclica para as dividas.

import { getCategoryDefs, CATEGORY_STACK_IDS } from '../../data/categories.js'

export const CAT_DEFS = getCategoryDefs(null, CATEGORY_STACK_IDS)

export const DEBT_COLORS = ['#ef4444', '#f97316', '#a78bfa', '#38bdf8', '#34d399']
