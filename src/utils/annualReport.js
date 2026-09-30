// ── Relatório anual (HTML autónomo) ────────────────────────────────
// Gera um ficheiro HTML claro e pronto a imprimir (Ctrl+P → PDF no
// browser) com o resumo do ano: património por mês, evolução, IRS
// (dividendos, juros, mais-valias) e PPR. Tudo derivado dos dados —
// função pura, sem side effects.

import { MONTHS_SHORT, formatEuro } from '../data/initialData.js'
import { irsYearSummary } from './calc/irsCalc.js'
import { pprTaxBenefit, pprInvestedInYear } from './calc/pprTaxCalc.js'
import { snapTotal } from './calc/incomeCalc.js'

const CAT_LABELS = {
  banco: 'Banco', poupanca: 'Poupança', acoes: 'Ações', etfs: 'ETFs',
  crypto: 'Cripto', ppr: 'PPR', aforro: 'Aforro',
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

const eur = v => esc(formatEuro(v))
const pct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

export function buildAnnualReportHTML(data, year) {
  const months = data?.years?.[year]?.months || {}
  const monthKeys = Object.keys(months).map(Number).sort((a, b) => a - b)
  const irs = irsYearSummary(data, year)

  // ── Património por mês ──
  const usedCats = [...new Set(monthKeys.flatMap(m => Object.keys(months[m] || {})))]
    .filter(c => monthKeys.some(m => (months[m]?.[c] || 0) !== 0))
  const patrimonyRows = monthKeys.map(m => {
    const snap = months[m]
    return `<tr><td>${esc(MONTHS_SHORT[m])}</td>${
      usedCats.map(c => `<td class="num">${eur(snap?.[c] || 0)}</td>`).join('')
    }<td class="num strong">${eur(snapTotal(snap) || 0)}</td></tr>`
  }).join('\n')

  const firstTotal = monthKeys.length ? snapTotal(months[monthKeys[0]]) : null
  const lastTotal  = monthKeys.length ? snapTotal(months[monthKeys.at(-1)]) : null
  const evolution  = firstTotal != null && lastTotal != null && firstTotal > 0
    ? { delta: lastTotal - firstTotal, ratio: (lastTotal - firstTotal) / firstTotal }
    : null

  // ── PPR ──
  const pprInvested = pprInvestedInYear(data?.ppr?.platforms, year)
  const pprBenefit  = pprTaxBenefit(data?.ppr?.platforms, year, data?.profile?.birthYear)

  const totalIRS = irs.dividends.totalIRS + irs.bankInterest.totalIRS
    + irs.aforroInterest.totalIRS + irs.stockGains.totalIRS + irs.cryptoGains.totalIRS

  const sections = []

  sections.push(`<section>
  <h2>Património por mês</h2>
  ${monthKeys.length ? `<table>
    <thead><tr><th>Mês</th>${usedCats.map(c => `<th class="num">${esc(CAT_LABELS[c] || c)}</th>`).join('')}<th class="num">Total</th></tr></thead>
    <tbody>${patrimonyRows}</tbody>
  </table>` : '<p class="muted">Sem snapshots mensais registados neste ano.</p>'}
  ${evolution ? `<p>Evolução no ano: <strong>${evolution.delta >= 0 ? '+' : ''}${eur(evolution.delta)}</strong> (${pct(evolution.ratio)}), de ${eur(firstTotal)} para ${eur(lastTotal)}.</p>` : ''}
</section>`)

  sections.push(`<section>
  <h2>Rendimentos e mais-valias (IRS)</h2>
  <table>
    <thead><tr><th>Categoria</th><th class="num">Bruto / Ganho</th><th class="num">IRS</th><th class="num">Líquido</th></tr></thead>
    <tbody>
      <tr><td>Dividendos (${irs.dividends.rows.length})</td><td class="num">${eur(irs.dividends.totalGross)}</td><td class="num">−${eur(irs.dividends.totalIRS)}</td><td class="num">${eur(irs.dividends.totalNet)}</td></tr>
      <tr><td>Juros — poupança (${irs.bankInterest.rows.length})</td><td class="num">${eur(irs.bankInterest.totalGross)}</td><td class="num">−${eur(irs.bankInterest.totalIRS)}</td><td class="num">${eur(irs.bankInterest.totalNet)}</td></tr>
      <tr><td>Juros — aforro (${irs.aforroInterest.rows.length})</td><td class="num">${eur(irs.aforroInterest.totalGross)}</td><td class="num">−${eur(irs.aforroInterest.totalIRS)}</td><td class="num">${eur(irs.aforroInterest.totalNet)}</td></tr>
      <tr><td>Mais-valias ações/ETFs (${irs.stockGains.rows.length})</td><td class="num">${eur(irs.stockGains.totalGain)}</td><td class="num">−${eur(irs.stockGains.totalIRS)}</td><td class="num">${eur(irs.stockGains.totalGain - irs.stockGains.totalIRS)}</td></tr>
      <tr><td>Mais-valias cripto (${irs.cryptoGains.rows.length})</td><td class="num">${eur(irs.cryptoGains.totalGain)}</td><td class="num">−${eur(irs.cryptoGains.totalIRS)}</td><td class="num">${eur(irs.cryptoGains.totalGain - irs.cryptoGains.totalIRS)}</td></tr>
    </tbody>
    <tfoot><tr><td class="strong">IRS total estimado</td><td></td><td class="num strong">−${eur(totalIRS)}</td><td></td></tr></tfoot>
  </table>
  <p class="muted">Valores informativos — confirma no Portal das Finanças. Dividendos sem imposto registado assumem retenção de 28%.</p>
</section>`)

  sections.push(`<section>
  <h2>PPR</h2>
  <p>Entregas em ${year}: <strong>${eur(pprInvested)}</strong>.
  ${pprBenefit.bracket
    ? `Dedução à coleta estimada: <strong>${eur(pprBenefit.deduction)}</strong> (teto ${eur(pprBenefit.bracket.maxDeduction)}, ${esc(pprBenefit.bracket.label)}).`
    : 'Define o ano de nascimento na app para estimar a dedução à coleta.'}
  </p>
</section>`)

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Thrive Finance — Relatório ${year}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 860px; margin: 32px auto; padding: 0 24px; color: #1a1a1a; }
  h1 { font-size: 1.5rem; margin-bottom: 2px; }
  h2 { font-size: 1.05rem; margin: 28px 0 10px; border-bottom: 2px solid #e5e5e5; padding-bottom: 6px; }
  .sub { color: #777; font-size: 0.85rem; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; }
  th { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .strong { font-weight: 700; }
  .muted { color: #999; font-size: 0.75rem; }
  tfoot td { border-top: 2px solid #ddd; border-bottom: none; }
  @media print { body { margin: 0; } section { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Thrive Finance — Relatório anual ${year}</h1>
<p class="sub">Gerado a ${new Date().toLocaleDateString('pt-PT')} · documento informativo, não substitui documentos oficiais</p>
${sections.join('\n')}
</body>
</html>`
}
