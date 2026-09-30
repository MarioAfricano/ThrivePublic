// ── Health checks ─────────────────────────────────────────────
//
// Corre um conjunto de invariantes sobre `data.json` e devolve uma lista
// de resultados estruturados. Cada `check(data)` é uma função pura que
// devolve:
//
//   {
//     id, label, severity: 'info'|'warning'|'error',
//     ok: bool,                // true se não há issues
//     issues: [{ message, path?, autoFixable? }],
//     fixable: bool,           // true se há fix() e há issues
//     fix: (data) => patch,    // devolve um *patch* parcial ao top-level
//                              //   de `data` (compatível com saveData)
//   }
//
// O fix devolve apenas as chaves top-level que precisam de mudar — o
// `saveData` da app faz `{ ...data, ...updates }` por cima.

import { generateId } from './id.js'
import { compareMK } from './dateUtils.js'
import { DataSchema } from '../schemas/index.js'

const EPS_STOCK  = 1e-5
const EPS_CRYPTO = 1e-8

function result(id, label, severity, issues, fix) {
  const ok = issues.length === 0
  return { id, label, severity, ok, issues, fixable: !!fix && !ok, fix: fix || null }
}

// ── 1. Ações & ETFs: holding.qty = Σ lots.qty ─────────────────
// Quando um holding tem `lots`, `holdingQtyAtMk` ignora o campo raiz `h.qty`.
// Mantê-lo inconsistente não parte nada, mas é um sinal de dados stale —
// o fix apaga `qty` do objecto (passa a ser calculado sempre a partir dos lots).
export function checkStocksQtySync(data) {
  const issues = []
  const lists = [
    ['acoes', data?.stocks?.acoes?.holdings || []],
    ['etfs',  data?.stocks?.etfs?.holdings  || []],
  ]
  for (const [kind, holdings] of lists) {
    for (const h of holdings) {
      if (!h.lots?.length) continue
      const sum = h.lots.reduce((s, l) => s + (l.qty || 0), 0)
      if (h.qty != null && Math.abs(h.qty - sum) > EPS_STOCK) {
        issues.push({
          message: `${kind} · ${h.ticker || h.name || h.id}: qty=${h.qty} ≠ Σ lots=${trim(sum)}`,
          path: `stocks.${kind}.holdings[id=${h.id}]`,
          autoFixable: true,
        })
      }
    }
  }
  return result('stocks-qty-sync', 'Quantidade de ações/ETFs sincronizada com os lotes', 'warning', issues, fixStocksQtySync)
}

function fixStocksQtySync(data) {
  const fixList = (holdings) => (holdings || []).map(h => {
    if (!h.lots?.length) return h
    const sum = h.lots.reduce((s, l) => s + (l.qty || 0), 0)
    if (h.qty != null && Math.abs(h.qty - sum) > EPS_STOCK) {
      const { qty, ...rest } = h
      return rest
    }
    return h
  })
  return {
    stocks: {
      ...(data.stocks || {}),
      acoes: { ...(data.stocks?.acoes || {}), holdings: fixList(data.stocks?.acoes?.holdings) },
      etfs:  { ...(data.stocks?.etfs  || {}), holdings: fixList(data.stocks?.etfs?.holdings) },
    },
  }
}

// ── 2. Crypto: holding.qty = Σ lots.qty ───────────────────────
export function checkCryptoQtySync(data) {
  const issues = []
  for (const p of (data?.crypto?.platforms || [])) {
    for (const h of (p.holdings || [])) {
      if (!h.lots?.length) continue
      const sum = h.lots.reduce((s, l) => s + (l.qty || 0), 0)
      if (h.qty != null && Math.abs(h.qty - sum) > EPS_CRYPTO) {
        issues.push({
          message: `${p.name || p.id} · ${h.ticker || h.id}: qty=${h.qty} ≠ Σ lots=${trim(sum)}`,
          path: `crypto.platforms[id=${p.id}].holdings[id=${h.id}]`,
          autoFixable: true,
        })
      }
    }
  }
  return result('crypto-qty-sync', 'Quantidade de crypto sincronizada com os lotes', 'warning', issues, fixCryptoQtySync)
}

function fixCryptoQtySync(data) {
  return {
    crypto: {
      ...(data.crypto || {}),
      platforms: (data.crypto?.platforms || []).map(p => ({
        ...p,
        holdings: (p.holdings || []).map(h => {
          if (!h.lots?.length) return h
          const sum = h.lots.reduce((s, l) => s + (l.qty || 0), 0)
          if (h.qty != null && Math.abs(h.qty - sum) > EPS_CRYPTO) {
            const { qty, ...rest } = h
            return rest
          }
          return h
        }),
      })),
    },
  }
}

// ── 3. IDs únicos ─────────────────────────────────────────────
// Varre todas as colecções principais. IDs duplicados ou em falta → issue.
// Fix: regenera os ids problemáticos com `generateId()`.
export function checkUniqueIds(data) {
  const issues = []
  for (const g of collectIdGroups(data)) {
    const seen = new Map()
    for (const e of g.ids) {
      if (!e.id) {
        issues.push({ message: `${g.path}: entrada sem id (${e.label || '?'})`, path: g.path, autoFixable: true })
        continue
      }
      if (seen.has(e.id)) {
        issues.push({
          message: `${g.path}: id "${e.id}" duplicado (${seen.get(e.id)} + ${e.label || '?'})`,
          path: g.path,
          autoFixable: true,
        })
      } else {
        seen.set(e.id, e.label || e.id)
      }
    }
  }
  return result('unique-ids', 'Identificadores únicos em todas as colecções', 'error', issues, fixUniqueIds)
}

function collectIdGroups(data) {
  const out = []
  const bankPlats = data?.banks?.platforms || []
  out.push({ path: 'banks.platforms', ids: bankPlats.map(p => ({ id: p.id, label: p.name })) })
  out.push({ path: 'banks.platforms[].accounts', ids: bankPlats.flatMap(p => (p.accounts || []).map(a => ({ id: a.id, label: `${p.name}·${a.name}` }))) })

  out.push({ path: 'stocks.acoes.holdings', ids: (data?.stocks?.acoes?.holdings || []).map(h => ({ id: h.id, label: h.ticker || h.name })) })
  out.push({ path: 'stocks.etfs.holdings',  ids: (data?.stocks?.etfs?.holdings  || []).map(h => ({ id: h.id, label: h.ticker || h.name })) })
  out.push({ path: 'stocks.bolsos',         ids: (data?.stocks?.bolsos          || []).map(b => ({ id: b.id, label: b.name })) })
  out.push({ path: 'stocks.freeFunds',      ids: (data?.stocks?.freeFunds       || []).map(f => ({ id: f.id, label: f.name })) })

  const cryptoPlats = data?.crypto?.platforms || []
  out.push({ path: 'crypto.platforms', ids: cryptoPlats.map(p => ({ id: p.id, label: p.name })) })
  out.push({ path: 'crypto.platforms[].holdings', ids: cryptoPlats.flatMap(p => (p.holdings || []).map(h => ({ id: h.id, label: `${p.name}·${h.ticker}` }))) })

  const pprPlats = data?.ppr?.platforms || []
  out.push({ path: 'ppr.platforms', ids: pprPlats.map(p => ({ id: p.id, label: p.name })) })
  out.push({ path: 'ppr.platforms[].accounts', ids: pprPlats.flatMap(p => (p.accounts || []).map(a => ({ id: a.id, label: `${p.name}·${a.name}` }))) })

  out.push({ path: 'aforro.certificates', ids: (data?.aforro?.certificates || []).map(c => ({ id: c.id, label: c.name })) })
  out.push({ path: 'debts',               ids: (data?.debts || []).map(d => ({ id: d.id, label: d.descricao || d.name })) })

  return out
}

function fixUniqueIds(data) {
  // Helpers: reatribui ids em falta ou já vistos num Set partilhado
  const ensureUnique = (arr, seen) => (arr || []).map(item => {
    if (!item?.id || seen.has(item.id)) {
      const newId = generateId()
      seen.add(newId)
      return { ...item, id: newId }
    }
    seen.add(item.id)
    return item
  })

  const patch = {}

  // Banks
  if (data.banks?.platforms) {
    const seenP = new Set(), seenA = new Set()
    patch.banks = {
      ...(data.banks || {}),
      platforms: data.banks.platforms.map(p => {
        const pOk = (!p.id || seenP.has(p.id)) ? { ...p, id: generateId() } : p
        seenP.add(pOk.id)
        return { ...pOk, accounts: ensureUnique(pOk.accounts, seenA) }
      }),
    }
  }

  // Stocks
  const stocksChanged = {}
  if (data.stocks?.acoes?.holdings) {
    const s = new Set()
    stocksChanged.acoes = { ...(data.stocks.acoes || {}), holdings: ensureUnique(data.stocks.acoes.holdings, s) }
  }
  if (data.stocks?.etfs?.holdings) {
    const s = new Set()
    stocksChanged.etfs = { ...(data.stocks.etfs || {}), holdings: ensureUnique(data.stocks.etfs.holdings, s) }
  }
  if (data.stocks?.bolsos) {
    const s = new Set()
    stocksChanged.bolsos = ensureUnique(data.stocks.bolsos, s)
  }
  if (data.stocks?.freeFunds) {
    const s = new Set()
    stocksChanged.freeFunds = ensureUnique(data.stocks.freeFunds, s)
  }
  if (Object.keys(stocksChanged).length) {
    patch.stocks = { ...(data.stocks || {}), ...stocksChanged }
  }

  // Crypto
  if (data.crypto?.platforms) {
    const seenP = new Set(), seenH = new Set()
    patch.crypto = {
      ...(data.crypto || {}),
      platforms: data.crypto.platforms.map(p => {
        const pOk = (!p.id || seenP.has(p.id)) ? { ...p, id: generateId() } : p
        seenP.add(pOk.id)
        return { ...pOk, holdings: ensureUnique(pOk.holdings, seenH) }
      }),
    }
  }

  // PPR
  if (data.ppr?.platforms) {
    const seenP = new Set(), seenA = new Set()
    patch.ppr = {
      ...(data.ppr || {}),
      platforms: data.ppr.platforms.map(p => {
        const pOk = (!p.id || seenP.has(p.id)) ? { ...p, id: generateId() } : p
        seenP.add(pOk.id)
        return { ...pOk, accounts: ensureUnique(pOk.accounts, seenA) }
      }),
    }
  }

  // Aforro
  if (data.aforro?.certificates) {
    const s = new Set()
    patch.aforro = { ...(data.aforro || {}), certificates: ensureUnique(data.aforro.certificates, s) }
  }

  // Debts
  if (data.debts) {
    const s = new Set()
    patch.debts = ensureUnique(data.debts, s)
  }

  return patch
}

// ── 4. Taxas de câmbio nos meses fechados (bancos) ────────────
// Para cada mês fechado, cada conta não-EUR deve ter rateToEUR válido
// (em `monthData[mk]` ou fallback na raiz da conta).
export function checkLockedMonthFxRates(data) {
  const issues = []
  const years = data?.years || {}
  for (const y of Object.keys(years)) {
    const locked = years[y].lockedMonths || []
    for (const m of locked) {
      const mk = `${y}-${m}`
      for (const p of (data?.banks?.platforms || [])) {
        for (const a of (p.accounts || [])) {
          const currency = a.currency || 'EUR'
          if (currency === 'EUR') continue
          if (a.startMK && compareMK(a.startMK, mk) > 0) continue
          if (a.deletedFromMK && compareMK(a.deletedFromMK, mk) <= 0) continue
          const rate = a.monthData?.[mk]?.rateToEUR ?? a.rateToEUR
          if (!rate || rate <= 0) {
            issues.push({
              message: `${p.name}·${a.name} (${currency}) em ${mk} [fechado]: sem taxa de câmbio`,
              path: `banks.platforms[id=${p.id}].accounts[id=${a.id}].monthData[${mk}]`,
            })
          }
        }
      }
    }
  }
  return result('locked-fx-rates', 'Taxas de câmbio presentes em meses fechados', 'warning', issues, null)
}

// ── 5. Snapshots dos meses fechados ───────────────────────────
export function checkLockedMonthSnapshots(data) {
  const issues = []
  const years = data?.years || {}
  for (const y of Object.keys(years)) {
    const locked = years[y].lockedMonths || []
    const months = years[y].months || {}
    for (const m of locked) {
      const snap = months[m]
      if (!snap || typeof snap !== 'object') {
        issues.push({
          message: `Ano ${y}, mês ${m} [fechado]: sem snapshot guardado`,
          path: `years[${y}].months[${m}]`,
        })
      }
    }
  }
  return result('locked-snapshots', 'Snapshots dos meses fechados presentes', 'warning', issues, null)
}

// ── 6. currentMonth/currentYear dentro de limites razoáveis ───
export function checkCurrentMonthSanity(data, now = new Date()) {
  const issues = []
  const y = data?.currentYear
  const m = data?.currentMonth
  if (!Number.isInteger(y) || y < 2000 || y > now.getFullYear() + 1) {
    issues.push({ message: `currentYear fora do intervalo razoável: ${y}`, path: 'currentYear' })
  }
  if (!Number.isInteger(m) || m < 0 || m > 11) {
    issues.push({ message: `currentMonth fora do intervalo [0,11]: ${m}`, path: 'currentMonth' })
  }
  return result('current-month-sanity', 'Mês actual dentro de limites válidos', 'error', issues, null)
}

// ── 7. Lots com mais qty vendida do que comprada (ações/ETFs) ─
// Para holdings com sell lots (isSell), o Σ qty não pode ser negativo —
// isso significaria que vendeste mais do que tens.
export function checkStockOversell(data) {
  const issues = []
  const lists = [
    ['acoes', data?.stocks?.acoes?.holdings || []],
    ['etfs',  data?.stocks?.etfs?.holdings  || []],
  ]
  for (const [kind, holdings] of lists) {
    for (const h of holdings) {
      if (!h.lots?.length) continue
      const sum = h.lots.reduce((s, l) => s + (l.qty || 0), 0)
      if (sum < -EPS_STOCK) {
        issues.push({
          message: `${kind} · ${h.ticker || h.id}: Σ lots = ${trim(sum)} (qty negativa — vendida mais do que comprada)`,
          path: `stocks.${kind}.holdings[id=${h.id}]`,
        })
      }
    }
  }
  return result('stocks-oversell', 'Nenhuma posição com qty negativa', 'error', issues, null)
}

// ── Orquestrador ──────────────────────────────────────────────
// ── 8. Ações & ETFs: lots sem mês (buyMk) ─────────────────────
// Sem buyMk, o lote não tem data: a TIR (XIRR) da Carteira trata-o como
// fluxo de hoje e os totais históricos por mês ignoram-no na régua
// temporal. Sem fix automático — a data correta só o utilizador a sabe
// (edita o lote na página Ações & ETFs).
export function checkLotsSemBuyMk(data) {
  const issues = []
  const lists = [
    ['acoes', data?.stocks?.acoes?.holdings || []],
    ['etfs',  data?.stocks?.etfs?.holdings  || []],
  ]
  for (const [kind, holdings] of lists) {
    for (const h of holdings) {
      for (const l of h.lots || []) {
        if (l.buyMk) continue
        issues.push({
          message: `${kind} · ${h.ticker || h.name || h.id}: lote ${l.isSell ? 'de venda' : 'de compra'} sem mês (qty=${trim(l.qty || 0)})`,
          path: `stocks.${kind}.holdings[id=${h.id}].lots[id=${l.id}]`,
          autoFixable: false,
        })
      }
    }
  }
  return result('lots-sem-buymk', 'Lotes de ações/ETFs com mês de compra definido', 'warning', issues, null)
}

// ── 9. Estrutura dos dados conforme o schema (Zod) ────────────
// Os mesmos erros que o saveData escreve na consola, mas visíveis na
// página Saúde. safeParse direto (sem logging) para não duplicar avisos.
export function checkSchemaValidation(data) {
  const parsed = DataSchema.safeParse(data)
  const issues = parsed.success ? [] : parsed.error.issues.slice(0, 20).map(i => ({
    message: `${i.path.join('.') || '(raiz)'}: ${i.message}`,
    path: i.path.join('.'),
    autoFixable: false,
  }))
  if (!parsed.success && parsed.error.issues.length > 20) {
    issues.push({ message: `… e mais ${parsed.error.issues.length - 20} erro(s)`, autoFixable: false })
  }
  return result('schema-validation', 'Estrutura dos dados conforme o schema', 'error', issues, null)
}

export function runAllChecks(data) {
  if (!data) return []
  return [
    checkCurrentMonthSanity(data),
    checkUniqueIds(data),
    checkStocksQtySync(data),
    checkCryptoQtySync(data),
    checkStockOversell(data),
    checkLockedMonthFxRates(data),
    checkLockedMonthSnapshots(data),
    checkLotsSemBuyMk(data),
    checkSchemaValidation(data),
  ]
}

// ── Utilitários ───────────────────────────────────────────────
function trim(n) {
  // Remove zeros à direita sem perder precisão útil
  return Number(n.toFixed(8)).toString()
}
