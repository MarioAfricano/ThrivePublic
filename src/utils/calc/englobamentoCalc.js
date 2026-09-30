// ── Englobamento vs. taxa autónoma (mais-valias mobiliárias, IRS PT) ─
// Mais-valias de ações/ETFs pagam por defeito a taxa autónoma de 28%.
// Por opção podem ser englobadas: somam ao rendimento coletável e pagam
// pelas taxas gerais progressivas. Compensa englobar quando a taxa
// média marginal sobre o ganho fica abaixo dos 28% (rendimentos baixos).
//
// Âmbito e limites deste cálculo (avisados na UI):
//   - Tabela do continente; não inclui deduções à coleta, mínimo de
//     existência, quociente conjugal nem adicional de solidariedade
//     (2,5% > 80 000 €; 5% > 250 000 €).
//   - Desde 2023, ganhos de ativos detidos < 365 dias são englobados
//     OBRIGATORIAMENTE quando o rendimento coletável está no último
//     escalão — nesse caso não há escolha.
//   - Menos-valias só são reportáveis (5 anos) optando pelo englobamento.

export const AUTONOMOUS_RATE = 0.28

// Escalões por ano fiscal (continente). Atualizar quando sair a tabela
// seguinte; `bracketsForYear` usa a mais recente ≤ ano pedido.
export const IRS_BRACKETS = {
  2025: [
    { upTo: 8059,     rate: 0.125 },
    { upTo: 12160,    rate: 0.16 },
    { upTo: 17233,    rate: 0.215 },
    { upTo: 22306,    rate: 0.244 },
    { upTo: 28400,    rate: 0.314 },
    { upTo: 41629,    rate: 0.349 },
    { upTo: 44987,    rate: 0.431 },
    { upTo: 83696,    rate: 0.446 },
    { upTo: Infinity, rate: 0.48 },
  ],
}

export function bracketsForYear(year) {
  const years = Object.keys(IRS_BRACKETS).map(Number).sort((a, b) => a - b)
  const best = years.filter(y => y <= year).at(-1) ?? years[0]
  return { brackets: IRS_BRACKETS[best], tableYear: best }
}

// Imposto pelas taxas gerais (método das fatias por escalão).
export function progressiveTax(income, brackets) {
  if (!income || income <= 0) return 0
  let tax = 0, lower = 0
  for (const { upTo, rate } of brackets) {
    if (income <= lower) break
    const slice = Math.min(income, upTo) - lower
    tax += slice * rate
    lower = upTo
  }
  return tax
}

/**
 * Compara a taxa autónoma (28%) com o englobamento para `gains` de
 * mais-valias, dado o rendimento coletável anual.
 * @returns {{ gains, taxAutonoma, taxEnglobamento, saving, better,
 *             effectiveRate, tableYear }}
 *   better: 'englobamento' | 'autonoma' | 'igual' | null (sem ganhos)
 *   saving: quanto se poupa escolhendo a melhor opção (>= 0)
 */
export function compareEnglobamento({ taxableIncome = 0, gains = 0, year = new Date().getFullYear() }) {
  const { brackets, tableYear } = bracketsForYear(year)
  if (!gains || gains <= 0) {
    return { gains, taxAutonoma: 0, taxEnglobamento: 0, saving: 0, better: null, effectiveRate: null, tableYear }
  }
  const taxAutonoma     = gains * AUTONOMOUS_RATE
  const taxEnglobamento = progressiveTax(taxableIncome + gains, brackets) - progressiveTax(taxableIncome, brackets)
  const diff = taxAutonoma - taxEnglobamento
  const better = Math.abs(diff) < 0.005 ? 'igual' : diff > 0 ? 'englobamento' : 'autonoma'
  return {
    gains,
    taxAutonoma,
    taxEnglobamento,
    saving: Math.abs(diff),
    better,
    effectiveRate: taxEnglobamento / gains,
    tableYear,
  }
}
