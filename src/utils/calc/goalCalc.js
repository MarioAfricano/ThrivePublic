// ── Metas de poupança por objetivo ──────────────────────────────
// Uma meta acompanha o valor atual de um subconjunto de categorias
// do património contra um alvo em €, opcionalmente com prazo.
//
//   goal: {
//     id:          string
//     nome:        string
//     alvo:        number (€)
//     deadlineMK:  'YYYY-M' (mês 0-indexed, opcional — convenção mk da app)
//     categorias:  ['poupanca', 'aforro', ...] (vazio/ausente = todas)
//     retornoAnual: number (fração, ex.: 0.07 = 7%/ano; opcional) — para
//                   metas de ações/ETFs, o ritmo necessário passa a assumir
//                   que o valor atual e os reforços crescem a esta taxa
//   }
//
// Puro e sem dependências — testável em Node.

export const GOAL_CATEGORY_LABELS = {
  poupanca: 'Poupança',
  aforro:   'Aforro',
  acoes:    'Ações',
  etfs:     'ETFs',
  ppr:      'PPR',
  banco:    'Banco',
  crypto:   'Cripto',
}

// Soma das categorias da meta no snapshot ao vivo do Dashboard
export function goalCurrent(goal, liveSnap) {
  const cats = goal?.categorias?.length
    ? goal.categorias
    : Object.keys(GOAL_CATEGORY_LABELS)
  return cats.reduce((s, c) => s + (liveSnap?.[c] || 0), 0)
}

// Meses disponíveis até ao FIM do mês do prazo, contando o mês corrente.
// Prazo no mês corrente → 1; prazo no mês passado → 0 (expirado).
export function monthsUntilMK(deadlineMK, now = new Date()) {
  if (!deadlineMK) return null
  const [y, m] = String(deadlineMK).split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null
  const diff = (y - now.getFullYear()) * 12 + (m - now.getMonth())
  return Math.max(0, diff + 1)
}

// Reforço mensal necessário para chegar a `alvo` em `months` meses,
// partindo de `atual` a crescer a `annualReturn`/ano (composto, capitalização
// mensal; reforços no fim de cada mês):
//   alvo = atual·(1+r)^n + PMT·((1+r)^n − 1)/r,  r = (1+anual)^(1/12) − 1
// Devolve 0 quando o crescimento sozinho já chega ao alvo; null sem meses.
// annualReturn 0/ausente degrada para o linear (alvo − atual)/n.
export function requiredMonthlyContribution(atual, alvo, months, annualReturn = 0) {
  if (!months || months <= 0) return null
  if (!annualReturn) return Math.max(0, alvo - atual) / months
  const r = Math.pow(1 + annualReturn, 1 / 12) - 1
  const growth = Math.pow(1 + r, months)
  const fv = atual * growth
  if (fv >= alvo) return 0
  return ((alvo - fv) * r) / (growth - 1)
}

// ── Aportes reais ───────────────────────────────────────────────
// Em vez da variação de VALOR (que mistura poupança com mercado), mede
// o dinheiro que entrou de facto nas categorias da meta:
//   acoes/etfs — compras (gasto) e vendas (−sellTotal) dos lotes,
//                mais entregas dos bolsos (etfs)
//   crypto     — compras dos lotes (gasto)
//   ppr        — contribuições (valorPago)
//   aforro     — certificados subscritos (amount)
// banco/poupanca não têm fluxos registados → variação de snapshots.
// Assim o retornoAnual da meta não conta o mercado duas vezes.

const FLOW_CATS = new Set(['acoes', 'etfs', 'crypto', 'ppr', 'aforro'])

function _mkIdx(mk) {
  const [y, m] = String(mk).split('-').map(Number)
  return Number.isFinite(y) && Number.isFinite(m) ? y * 12 + m : null
}
function _dateIdx(dateStr) {
  const d = new Date(dateStr)
  return isNaN(d) ? null : d.getFullYear() * 12 + d.getMonth()
}

// Soma dos fluxos de uma categoria no intervalo de índices [from, to] (y*12+m)
function _categoryFlows(cat, data, from, to) {
  const inRange = (idx) => idx != null && idx >= from && idx <= to
  let sum = 0
  if (cat === 'acoes' || cat === 'etfs') {
    for (const h of data?.stocks?.[cat]?.holdings || []) {
      for (const lot of h.lots || []) {
        const idx = lot.buyMk != null ? _mkIdx(lot.buyMk) : _dateIdx(lot.buyDate)
        if (!inRange(idx)) continue
        sum += lot.isSell ? -(lot.sellTotal || 0) : (lot.gasto || 0)
      }
    }
    if (cat === 'etfs') {
      for (const b of data?.stocks?.bolsos || []) {
        for (const e of b.entregas || []) {
          if (inRange(_dateIdx(e.date))) sum += e.amount || 0
        }
      }
    }
  } else if (cat === 'crypto') {
    for (const p of data?.crypto?.platforms || []) {
      for (const h of p.holdings || []) {
        for (const lot of h.lots || []) {
          if (inRange(_dateIdx(lot.buyDate))) sum += lot.gasto || 0
        }
      }
    }
  } else if (cat === 'ppr') {
    for (const p of data?.ppr?.platforms || []) {
      for (const a of p.accounts || []) {
        for (const c of a.contributions || []) {
          if (inRange(_mkIdx(c.mk))) sum += c.valorPago || 0
        }
      }
    }
  } else if (cat === 'aforro') {
    for (const c of data?.aforro?.certificates || []) {
      if (inRange(_dateIdx(c.date))) sum += c.amount || 0
    }
  }
  return sum
}

// Ritmo de reforço real: aportes médios/mês das categorias com fluxos nos
// últimos `window` meses (mês corrente incluído), somados à variação média
// mensal de banco/poupança por snapshots (não têm fluxos registados).
// Devolve { pace, months, isFlow: true } ou null sem nada mensurável.
export function goalContributionPace(goal, data, liveSnap, y, m, window = 6) {
  const cats = goal?.categorias?.length
    ? goal.categorias
    : Object.keys(GOAL_CATEGORY_LABELS)
  const flowCats = cats.filter(c => FLOW_CATS.has(c))
  const cashCats = cats.filter(c => c === 'banco' || c === 'poupanca')

  let pace = null
  if (flowCats.length) {
    const to = y * 12 + m
    const total = flowCats.reduce((s, c) => s + _categoryFlows(c, data, to - window + 1, to), 0)
    pace = total / window
  }
  if (cashCats.length) {
    const cashLive = cashCats.reduce((s, c) => s + (liveSnap?.[c] || 0), 0)
    const cash = goalActualPace({ categorias: cashCats }, data?.years, cashLive, y, m, window)
    if (cash) pace = (pace || 0) + cash.pace
  }
  return pace == null ? null : { pace, months: window, isFlow: true }
}

// Ritmo real da meta: variação média mensal das categorias da meta,
// medida do snapshot mais antigo disponível na janela [m−window, m−1]
// até ao valor ao vivo `atual`. Nota: snapshots antigos podem não ter
// aforro/ppr — nesses meses o ritmo sai sobrestimado.
// Devolve { pace, months } ou null sem snapshots na janela.
export function goalActualPace(goal, years, atual, y, m, window = 6) {
  const cats = goal?.categorias?.length
    ? goal.categorias
    : Object.keys(GOAL_CATEGORY_LABELS)
  for (let i = window; i >= 1; i--) {
    const idx = y * 12 + m - i
    const snap = years?.[Math.floor(idx / 12)]?.months?.[idx % 12]
    if (snap) {
      const base = cats.reduce((s, c) => s + (snap[c] || 0), 0)
      return { pace: (atual - base) / i, months: i }
    }
  }
  return null
}

// Meses até atingir `alvo` reforçando `pmt`/mês, com o valor a crescer a
// `annualReturn`/ano (composto mensal). 0 se já lá está; null se nunca
// chega (ritmo ≤ 0 sem crescimento que compense) ou se demorar >maxMonths.
export function monthsToReach(atual, alvo, pmt, annualReturn = 0, maxMonths = 1200) {
  if (atual >= alvo) return 0
  const r = annualReturn ? Math.pow(1 + annualReturn, 1 / 12) - 1 : 0
  if (r <= 0) {
    if (!pmt || pmt <= 0) return null
    return Math.ceil((alvo - atual) / pmt)
  }
  let n
  if (!pmt || pmt <= 0) {
    // Só crescimento (ignora ritmos negativos: dinheiro a sair não converge)
    if (atual <= 0 || (pmt != null && pmt < 0)) return null
    n = Math.log(alvo / atual) / Math.log(1 + r)
  } else {
    n = Math.log((alvo + pmt / r) / (atual + pmt / r)) / Math.log(1 + r)
  }
  return n <= maxMonths ? Math.ceil(n) : null
}

// Estado completo de uma meta para render:
//   { atual, alvo, pct, falta, atingido, mesesRestantes, ritmoNecessario, expirado }
// pct é limitado a 100; ritmoNecessario é €/mês para chegar ao alvo a tempo
// (null sem prazo, meta atingida ou prazo expirado; 0 quando o retorno
// esperado leva lá sozinho — ver requiredMonthlyContribution).
export function goalProgress(goal, liveSnap, now = new Date()) {
  const atual    = goalCurrent(goal, liveSnap)
  const alvo     = goal?.alvo || 0
  const pct      = alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0
  const falta    = Math.max(0, alvo - atual)
  const atingido = alvo > 0 && atual >= alvo

  let mesesRestantes = null
  let ritmoNecessario = null
  let expirado = false
  if (goal?.deadlineMK != null && !atingido) {
    mesesRestantes = monthsUntilMK(goal.deadlineMK, now)
    if (mesesRestantes === 0) expirado = true
    else if (mesesRestantes != null) {
      ritmoNecessario = requiredMonthlyContribution(atual, alvo, mesesRestantes, goal.retornoAnual || 0)
    }
  }

  return { atual, alvo, pct, falta, atingido, mesesRestantes, ritmoNecessario, expirado }
}
