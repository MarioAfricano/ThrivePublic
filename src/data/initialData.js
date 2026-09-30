// Dados iniciais migrados do Excel Dinheiro2025.xlsx
//
// Nota: os helpers utilitários puros (datas, câmbios, formatação) vivem em
// `src/utils/`. Este ficheiro re-exporta os mais usados para não partir os
// imports existentes nas páginas.

import { getMK, compareMK, mkToNum } from '../utils/dateUtils.js'
import { formatEuro, formatPct, formatPP } from '../utils/format.js'
import { calcAforroTotal as _calcAforroTotal } from '../utils/calc/savingsCalc.js'
import {
  isAccVisible as _isAccVisible,
  getAccData as _getAccData,
  platformTotal as _platformTotal,
  calcSavingsTotal as _calcSavingsTotal,
  calcBancoTotal as _calcBancoTotal,
} from '../utils/calc/bankingCalc.js'
import { calcCryptoTotal as _calcCryptoTotal } from '../utils/calc/cryptoCalc.js'
import {
  calcHoldingsTotal as _calcHoldingsTotal,
  calcBolsosTotal as _calcBolsosTotal,
} from '../utils/calc/stockCalc.js'

export { getMK, compareMK, mkToNum, formatEuro, formatPct, formatPP }

// Re-export banking helpers (fonte de verdade: utils/calc/bankingCalc.js)
export const isAccVisible     = _isAccVisible
export const getAccData       = _getAccData
export const platformTotal    = _platformTotal
export const calcSavingsTotal = _calcSavingsTotal
export const calcBancoTotal   = _calcBancoTotal

// ── Meses ──────────────────────────────────────────────────────
export const MONTHS       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ── Moedas suportadas ─────────────────────────────────────────
export const CURRENCIES = ['EUR','USD','GBP','CHF','SEK','NOK','DKK','PLN','BRL','JPY','CAD','AUD']

// Objetivo anual de poupança por defeito (novos anos sem goal definido)
export const DEFAULT_GOAL = 11500

export const INITIAL_DATA = {
  version: '1.0',
  schemaVersion: 1,

  // ── Mês/Ano actuais (para registo e navegação) ─────────────
  currentYear:  new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0 = Janeiro … 11 = Dezembro

  // ── Dados anuais: objectivos + instantâneos mensais ────────
  years: {},

  // ── PATRIMÓNIO ────────────────────────────────────────────
  patrimony: {
    startOfYear: 0,
  },

  // ── BANCOS ────────────────────────────────────────────────
  // Estrutura: plataformas → contas → tipo de conta
  // Tipos:
  //   'conta'              — conta normal, sem juros
  //   'poupanca'           — poupança com juros (chegam na totalidade)
  //   'poupanca_desconto'  — poupança com retenção na fonte (IRS descontado antes de chegar)
  banks: {
    platforms: [],
  },

  // ── AFORRO ───────────────────────────────────────────────
  // euribor: taxa Euribor 3M actual (decimal, ex: 0.02294 = 2.294%)
  // euriborUpdated: mês da última actualização ("YYYY-M")
  // certificates: um registo por depósito
  //   rateHistory: { [periodStart]: rate } — taxa fixada a cada 3 meses
  //   valueOverride: substituição manual do valor calculado (null = automático)
  aforro: {
    euribor: 0,
    euriborUpdated: null,
    certificates: [],
  },

  // ── CRIPTOMOEDA ──────────────────────────────────────────
  // Estrutura: plataformas → holdings → lotes
  //   holding.price             — preço atual (editável ao vivo)
  //   holding.monthData[mk]     = { price } — preço histórico ao fechar mês
  //   holding.lots[].buyDate    — data de compra (para IRS e filtragem histórica)
  //   years[y].lockedMonths     — meses fechados (preços congelados)
  crypto: {
    platforms: [],
    years: {},
  },

  // ── PPR ──────────────────────────────────────────────────
  // Estrutura: plataformas → contas
  //   conta.monthData[mk] = { balance }          — saldo por mês
  //   conta.contributions = [{id, valorPago, valorColocado, mk, note}]  — histórico global
  ppr: {
    platforms: [],
  },

  // ── AÇÕES & ETFs ─────────────────────────────────────────
  stocks: {
    acoes: {
      holdings: [],
    },
    etfs: {
      holdings: [],
    },
    bolsos: [],
    // Fundos livres por corretora (dinheiro não investido)
    freeFunds: [
      { id: 'xtb',    name: 'XTB',    amount: 0 },
      { id: 'degiro', name: 'Degiro', amount: 0 },
    ],
  },

  // ── DÍVIDAS ──────────────────────────────────────────────
  // Estrutura: lista de empréstimos/créditos
  //   montanteInicial — capital em dívida no início
  //   prestacaoMensal — prestação base mensal (pode variar)
  //   diaDebito       — dia do mês em que é debitado (1–28)
  //                     se >= 2, a prestação conta para o mês seguinte
  //   inicioMK        — mês em que o empréstimo começa ("YYYY-M")
  //   ativa           — false = liquidada (arquivo)
  //   pagamentos[mk]  = { pago, valor, saldoRestante }
  debts: [],

  // Preferências da funcionalidade de dívidas
  debtSettings: {
    showOnDashboard: false,
  },
}

// ── Helpers de cálculo bancário ───────────────────────────────
// Fonte de verdade: `src/utils/calc/bankingCalc.js`
// (platformTotal/calcSavingsTotal/calcBancoTotal/isAccVisible/getAccData
//  são re-exportados no topo do ficheiro).

// ── Helpers Ações & ETFs ──────────────────────────────────────
// Fonte de verdade: `src/utils/calc/stockCalc.js`. Re-exportados abaixo.
export {
  holdingEarliestBuyMk,
  holdingQtyAtMk,
  holdingGastoAtMk,
  holdingActiveInMk,
  calcHoldingValue,
  calcHoldingsTotal,
  calcDividendsYear,
  calcAllDividendsYear,
  calcBolsosTotal,
} from '../utils/calc/stockCalc.js'

// ── Helpers PPR ───────────────────────────────────────────────

// Verifica se uma plataforma PPR é visível num mês (mesma lógica que isAccVisible)
export function isPPRPlatformVisible(platform, mk) {
  if (!mk) return true
  if (platform.startMK       && compareMK(platform.startMK, mk)       > 0) return false
  if (platform.deletedFromMK && compareMK(platform.deletedFromMK, mk) <= 0) return false
  return true
}

// Saldo PPR de uma conta para um mês (fallback: 0)
export function getPPRAccData(acc, monthKey) {
  if (monthKey && acc.monthData?.[monthKey]) return acc.monthData[monthKey]
  return { balance: acc.balance || 0 }
}

// Total do saldo PPR para um mês específico (respeita startMK / deletedFromMK)
export function calcPPRTotal(platforms, monthKey = null) {
  return (platforms || [])
    .filter(p => isPPRPlatformVisible(p, monthKey))
    .reduce((sum, p) =>
      sum + (p.accounts || []).reduce((s, a) =>
        s + (getPPRAccData(a, monthKey).balance || 0), 0), 0)
}

// Uma contribuição conta para o mês mk se:
//   day <= 1 → conta a partir do próprio mês (entrega no dia 1)
//   day >  1 → só conta a partir do mês seguinte (entrega a meio do mês)
export function isContribActiveForMK(c, currentMK) {
  const day = c.day || 1
  if (day <= 1) return compareMK(c.mk, currentMK) <= 0
  const [cy, cm] = c.mk.split('-').map(Number)
  const nextM = cm === 11 ? 0 : cm + 1
  const nextY = cm === 11 ? cy + 1 : cy
  return compareMK(getMK(nextY, nextM), currentMK) <= 0
}

// Totais de contribuições (valorPago e valorColocado) — filtrado até um mês (inclusive)
// Respeita o campo day: entregas após o dia 1 só contam a partir do mês seguinte
// Se mk for null, inclui todas as contribuições (histórico global)
export function calcPPRContribTotals(platforms, mk = null) {
  let pago = 0, colocado = 0, countEntregas = 0, countLevantamentos = 0
  for (const p of (platforms || [])) {
    for (const a of (p.accounts || [])) {
      for (const c of (a.contributions || [])) {
        if (mk && !isContribActiveForMK(c, mk)) continue
        pago     += c.valorPago     || 0
        colocado += c.valorColocado || 0
        if ((c.valorPago || 0) < 0) countLevantamentos++
        else countEntregas++
      }
    }
  }
  return { pago, colocado, encargos: pago - colocado, countEntregas, countLevantamentos }
}

// ── Cálculo histórico de juros dos Certificados de Aforro ───────
// Movido para src/utils/calc/savingsCalc.js. Re-exportado aqui para preservar
// os imports existentes.
export const calcAforroTotal = _calcAforroTotal

// ── Helpers Criptomoeda ───────────────────────────────────────────
// Fonte de verdade: `src/utils/calc/cryptoCalc.js`. Re-exportado abaixo.
export { calcCryptoTotal } from '../utils/calc/cryptoCalc.js'

// Instantâneo das categorias a partir dos dados em vigor para um mês específico.
// `liveRates` (opcional): câmbios EUR-base para converter holdings não-EUR.
export function computeSnapshot(data, monthKey = null, liveRates = null) {
  const key = monthKey || getMK(data.currentYear ?? new Date().getFullYear(), data.currentMonth ?? new Date().getMonth())
  return {
    banco:    _calcBancoTotal(data.banks?.platforms || [], key),
    poupanca: _calcSavingsTotal(data.banks?.platforms || [], key),
    acoes:    _calcHoldingsTotal(data.stocks?.acoes?.holdings, key, liveRates),
    etfs:     _calcHoldingsTotal(data.stocks?.etfs?.holdings, key, liveRates) + _calcBolsosTotal(data.stocks?.bolsos, key),
    crypto:   _calcCryptoTotal(data.crypto, key),
    ppr:      calcPPRTotal(data.ppr?.platforms || [], key),
    aforro:   _calcAforroTotal(data.aforro, key),
  }
}
