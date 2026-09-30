// ── Fecho de mês unificado ─────────────────────────────────────────
// A app tem três sistemas de lock independentes: global/bancos
// (`years[y].lockedMonths`), ações (`stocks.years[y].lockedMonths`) e
// crypto (`crypto.years[y].lockedMonths`). Fechar/abrir mês — nos
// botões das páginas Bancos/Ações/Cripto, no lembrete e na paleta
// Ctrl+K — actua nos TRÊS de uma vez: evita meses meio-fechados.
//
// Para crypto, replica o comportamento do closeMonth da página: congela
// o preço actual em monthData[mk].price quando ainda não há snapshot.

import { DEFAULT_GOAL } from '../data/initialData.js'

export function buildLockMonthPatch(data, y, m) {
  const mk = `${y}-${m}`
  const patch = {}

  // 1. Global / bancos
  const years = data?.years || {}
  const yd = years[y] || { goal: DEFAULT_GOAL, lockedMonths: [], months: {} }
  if (!(yd.lockedMonths || []).includes(m)) {
    patch.years = { ...years, [y]: { ...yd, lockedMonths: [...(yd.lockedMonths || []), m] } }
  }

  // 2. Ações & ETFs
  const stocks = data?.stocks
  if (stocks) {
    const sYears = stocks.years || {}
    const sy = sYears[y] || { lockedMonths: [] }
    if (!(sy.lockedMonths || []).includes(m)) {
      patch.stocks = {
        ...stocks,
        years: { ...sYears, [y]: { ...sy, lockedMonths: [...(sy.lockedMonths || []), m] } },
      }
    }
  }

  // 3. Crypto (com snapshot de preço, como o closeMonth da página Crypto)
  const crypto = data?.crypto
  if (crypto?.platforms) {
    const cYears = crypto.years || {}
    const cy = cYears[y] || {}
    if (!((cy.lockedMonths || []).includes(m))) {
      patch.crypto = {
        ...crypto,
        platforms: crypto.platforms.map(p => ({
          ...p,
          holdings: (p.holdings || []).map(h => ({
            ...h,
            monthData: {
              ...(h.monthData || {}),
              [mk]: { ...(h.monthData?.[mk] || {}), price: h.monthData?.[mk]?.price ?? h.price ?? 0 },
            },
          })),
        })),
        years: { ...cYears, [y]: { ...cy, lockedMonths: [...(cy.lockedMonths || []), m] } },
      }
    }
  }

  return patch
}

// Reabre o mês nos três sistemas (só remove dos lockedMonths — os
// snapshots de preço/câmbio congelados ficam e voltam a valer se o mês
// for fechado de novo).
export function buildUnlockMonthPatch(data, y, m) {
  const patch = {}

  const years = data?.years || {}
  if ((years[y]?.lockedMonths || []).includes(m)) {
    patch.years = { ...years, [y]: { ...years[y], lockedMonths: years[y].lockedMonths.filter(x => x !== m) } }
  }

  const stocks = data?.stocks
  const sYears = stocks?.years || {}
  if ((sYears[y]?.lockedMonths || []).includes(m)) {
    patch.stocks = {
      ...stocks,
      years: { ...sYears, [y]: { ...sYears[y], lockedMonths: sYears[y].lockedMonths.filter(x => x !== m) } },
    }
  }

  const crypto = data?.crypto
  const cYears = crypto?.years || {}
  if ((cYears[y]?.lockedMonths || []).includes(m)) {
    patch.crypto = {
      ...crypto,
      years: { ...cYears, [y]: { ...cYears[y], lockedMonths: cYears[y].lockedMonths.filter(x => x !== m) } },
    }
  }

  return patch
}

// O mês está totalmente fechado (nos três sistemas)?
export function isMonthFullyLocked(data, y, m) {
  const globalLocked = (data?.years?.[y]?.lockedMonths || []).includes(m)
  const stocksLocked = !data?.stocks || (data.stocks.years?.[y]?.lockedMonths || []).includes(m)
  const cryptoLocked = !data?.crypto?.platforms?.length || (data.crypto.years?.[y]?.lockedMonths || []).includes(m)
  return globalLocked && stocksLocked && cryptoLocked
}
