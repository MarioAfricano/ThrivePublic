// ── Próximos eventos ───────────────────────────────────────────────
// Lista cronológica do que vem aí: débitos de dívidas, pagamentos
// trimestrais de juros do aforro, maturidades de certificados e o prazo
// da dedução PPR. Puro (`now` injetável); cada evento:
//   { date: Date, label, amount?, page }

import { formatEuro } from '../data/initialData.js'
import { compareMK } from './dateUtils.js'
import { aforroNextPaymentDate, aforroEstimateNextPayment } from './calc/savingsCalc.js'
import { pprTaxBenefit } from './calc/pprTaxCalc.js'
import { aforroMaturity } from './reminders.js'

const DAY_MS = 86400000

export function computeUpcomingEvents(data, now = new Date(), horizonDays = 90, maxEvents = 8) {
  if (!data) return []
  const out = []
  const limit = new Date(now.getTime() + horizonDays * DAY_MS)

  // ── Débitos de dívidas (ocorrências dentro do horizonte) ──
  for (const debt of data.debts || []) {
    if (!debt.ativa || !debt.diaDebito) continue
    for (let i = 0; i < Math.ceil(horizonDays / 28) + 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, debt.diaDebito)
      if (d < now || d > limit) continue
      const mk = `${d.getFullYear()}-${d.getMonth()}`
      if (debt.inicioMK && compareMK(debt.inicioMK, mk) > 0) continue
      out.push({
        date: d, page: 'dividas',
        label: `Prestação «${debt.nome}»`,
        amount: debt.prestacaoMensal || null,
      })
    }
  }

  // ── Aforro: próximos juros trimestrais + maturidades ──
  const euribor = data.aforro?.euribor || 0
  for (const cert of data.aforro?.certificates || []) {
    if (!cert.date) continue
    const label = cert.notes || `certificado de ${new Date(cert.date).getFullYear()}`
    const next = aforroNextPaymentDate(cert.date, now.getTime())
    if (next >= now && next <= limit) {
      const est = aforroEstimateNextPayment(cert, euribor, now.getTime())
      out.push({
        date: next, page: 'savings',
        label: `Juros do aforro (${label})`,
        amount: est > 0 ? est : null, approx: true,
      })
    }
    const mat = aforroMaturity(cert.date)
    if (mat && mat.maturity >= now && mat.maturity <= limit) {
      out.push({
        date: mat.maturity, page: 'savings',
        label: `Maturidade do aforro (${label}, série ${mat.serie})`,
        amount: cert.amount || null,
      })
    }
  }

  // ── Prazo da dedução PPR (31 de dezembro) ──
  const dec31 = new Date(now.getFullYear(), 11, 31)
  if (dec31 >= now && dec31 <= limit) {
    const b = pprTaxBenefit(data.ppr?.platforms, now.getFullYear(), data.profile?.birthYear)
    if (b.bracket && !b.maxed) {
      out.push({
        date: dec31, page: 'ppr',
        label: `Prazo dedução PPR — faltam ${formatEuro(b.remainingInvestment)}`,
        amount: null,
      })
    }
  }

  return out.sort((a, b) => a.date - b.date).slice(0, maxEvents)
}

// Corpo de uma notificação nativa a partir de eventos próximos.
// null sem eventos; corta a 4 linhas (limite prático dos toasts Windows).
export function buildEventsNotification(events) {
  if (!events?.length) return null
  const lines = events.slice(0, 4).map(e => {
    const d = `${e.date.getDate()}/${e.date.getMonth() + 1}`
    return `${d} · ${e.label}${e.amount ? ` · ${e.approx ? '≈' : ''}${formatEuro(e.amount)}` : ''}`
  })
  if (events.length > 4) lines.push(`… e mais ${events.length - 4}`)
  return {
    title: events.length === 1 ? 'Thrive — evento próximo' : `Thrive — ${events.length} eventos próximos`,
    body: lines.join('\n'),
  }
}
