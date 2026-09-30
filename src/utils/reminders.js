// ── Lembretes ──────────────────────────────────────────────────────
// Calcula avisos accionáveis a partir dos dados + data real. Puro e
// testável: `now` é injectável. Cada lembrete:
//   { id, severity: 'info'|'warn', page, message }
// `page` é o id de navegação da Sidebar (setPage) para o clique.

import { MONTHS, formatEuro } from '../data/initialData.js'
import { compareMK } from './dateUtils.js'
import { pprTaxBenefit } from './calc/pprTaxCalc.js'
import { isMonthFullyLocked } from './lockMonth.js'

const DAY_MS = 24 * 3600 * 1000

// Certificados de Aforro: série E (out 2017 – mai 2023) tem prazo de
// 10 anos; série F (desde jun 2023) tem 15. Inferido pela data de
// subscrição — a app não guarda a série explicitamente.
export function aforroMaturity(dateStr) {
  const start = new Date(dateStr)
  if (isNaN(start)) return null
  const isSerieE = start < new Date(2023, 5, 1)
  const years = isSerieE ? 10 : 15
  const maturity = new Date(start)
  maturity.setFullYear(start.getFullYear() + years)
  return { maturity, serie: isSerieE ? 'E' : 'F', years }
}

export function computeReminders(data, now = new Date()) {
  if (!data) return []
  const out = []
  const y = now.getFullYear()
  const m = now.getMonth()

  // 1. Mês anterior com snapshot mas por fechar — em QUALQUER dos três
  // sistemas de lock (global/bancos, ações, crypto); a ação fecha todos.
  const py = m === 0 ? y - 1 : y
  const pm = m === 0 ? 11 : m - 1
  const yd = data.years?.[py]
  if (yd?.months?.[pm] && !isMonthFullyLocked(data, py, pm)) {
    out.push({
      id: 'close-prev-month', severity: 'warn', page: 'dashboard',
      message: `${MONTHS[pm]} ${py} ainda não está totalmente fechado — fecha-o para congelar os valores (bancos, ações e crypto).`,
      action: { type: 'lock-month', label: 'Fechar mês', y: py, m: pm },
    })
  }

  // 2. Certificados de Aforro perto (ou depois) da maturidade
  for (const cert of data.aforro?.certificates || []) {
    if (!cert.date) continue
    const info = aforroMaturity(cert.date)
    if (!info) continue
    const days  = Math.floor((info.maturity - now) / DAY_MS)
    const label = cert.notes || `Certificado de ${new Date(cert.date).getFullYear()}`
    if (days < 0) {
      out.push({
        id: `aforro-matured-${cert.id}`, severity: 'warn', page: 'savings',
        message: `${label} (${formatEuro(cert.amount)}) atingiu a maturidade da série ${info.serie} (${info.years} anos) — deixou de capitalizar.`,
      })
    } else if (days <= 180) {
      out.push({
        id: `aforro-maturing-${cert.id}`, severity: 'info', page: 'savings',
        message: `${label} (${formatEuro(cert.amount)}) atinge a maturidade em ${info.maturity.toLocaleDateString('pt-PT')}.`,
      })
    }
  }

  // 3. Teto do benefício fiscal PPR por aproveitar (outubro–dezembro)
  if (m >= 9) {
    const b = pprTaxBenefit(data.ppr?.platforms, y, data.profile?.birthYear)
    if (b.bracket && !b.maxed) {
      out.push({
        id: 'ppr-teto', severity: 'info', page: 'ppr',
        message: `Faltam ${formatEuro(b.remainingInvestment)} de entregas PPR para maximizares a dedução de ${y} — tens até 31 de dezembro.`,
      })
    }
  }

  // 4. Prestação de dívida sem registo depois do dia de débito
  const mk = `${y}-${m}`
  for (const debt of data.debts || []) {
    if (!debt.ativa || !debt.diaDebito) continue
    if (debt.inicioMK && compareMK(debt.inicioMK, mk) > 0) continue
    if (now.getDate() <= debt.diaDebito) continue
    const entry = debt.pagamentos?.[mk]
    const paid  = Array.isArray(entry) ? entry.length > 0 : !!entry?.pago
    if (!paid) {
      out.push({
        id: `debt-${debt.id}`, severity: 'warn', page: 'dividas',
        message: `Prestação de «${debt.nome}» ainda sem registo este mês (débito ao dia ${debt.diaDebito}).`,
        action: { type: 'pay-debt', label: `Registar ${formatEuro(debt.prestacaoMensal || 0)}`, debtId: debt.id, mk },
      })
    }
  }

  return out
}
