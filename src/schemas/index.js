// ── Schemas de validação Zod (v4) ───────────────────────────────────
// Valida a estrutura do data.json ao carregar e ao guardar.
// Regras de uso:
//   - safeParse apenas — nunca lançar; em caso de erro fazer console.warn.
//   - Os schemas são permissivos (campos opcionais, strip mode silencioso)
//     para aguentar dados legados e futuras adições sem partir a app.
//   - mk = "YYYY-M" com M 0-indexed (ex: "2025-0" = Janeiro 2025).
//
// Notas de compatibilidade Zod v4:
//   - z.object() usa strip por default (ignora campos extra sem falhar).
//   - .nullable().optional() → .nullish()
//   - z.record(valueType) → z.record(z.string(), valueType)
//   - z.union() ainda funciona mas discriminatedUnion é preferível quando possível.

import { z } from 'zod'

// ── Primitivos partilhados ─────────────────────────────────────────
const mkString = z.string().regex(/^\d{4}-\d{1,2}$/)
const mkOpt    = mkString.optional()   // mk pode estar ausente; quando presente é "YYYY-M"

// ── Bancos ─────────────────────────────────────────────────────────

export const AccountSchema = z.object({
  id:             z.string(),
  name:           z.string().optional(),
  type:           z.enum(['conta', 'poupanca', 'poupanca_desconto']),
  currency:       z.string().optional(),
  balance:        z.number().optional(),
  interest:       z.number().optional(),
  rateToEUR:      z.number().optional(),
  taxRate:        z.number().optional(),
  startMK:        mkOpt,
  deletedFromMK:  mkOpt,
  interestHistory: z.array(z.any()).optional(),
  monthData:      z.record(z.string(), z.object({
    balance:         z.number().optional(),
    interest:        z.number().optional(),
    rateToEUR:       z.number().optional(),
    interestHistory: z.array(z.any()).optional(),
  })).optional(),
})

export const BankPlatformSchema = z.object({
  id:            z.string(),
  name:          z.string(),
  fullName:      z.string().optional(),
  color:         z.string().optional(),
  startMK:       mkOpt,
  deletedFromMK: mkOpt,
  accounts:      z.array(AccountSchema),
})

// ── Ações & ETFs ───────────────────────────────────────────────────

export const StockLotSchema = z.object({
  id:        z.string().optional(),
  srcId:     z.string().optional(),   // origem externa (import XTB) — dedupe
  buyMk:     mkOpt,
  qty:       z.number(),
  price:     z.number().optional(),
  gasto:     z.number().optional(),
  taxa:      z.number().optional(),
  isSell:    z.boolean().optional(),
  sellTotal: z.number().optional(),
  sellPrice: z.number().optional(),
  buyDate:   z.string().optional(),
})

export const DividendSchema = z.object({
  id:     z.string().optional(),
  srcId:  z.string().optional(),      // origem externa (import XTB) — dedupe
  mk:     z.string().optional(),
  date:   z.string().optional(),
  amount: z.number(),
  tax:    z.number().optional(),      // retenção na fonte registada
})

export const HoldingSchema = z.object({
  id:       z.string(),
  ticker:   z.string(),
  name:     z.string().optional(),
  lots:     z.array(StockLotSchema).optional(),
  price:    z.number().optional(),
  buyMk:    mkOpt,
  sellMk:   mkOpt,
  platform: z.string().optional(),
  currency: z.string().optional(),
  dividends: z.array(DividendSchema).optional(),
  monthData: z.record(z.string(), z.object({
    price:     z.number().optional(),
    qty:       z.number().optional(),
    rateToEUR: z.number().optional(),   // câmbio congelado (invariante dos meses fechados)
  })).optional(),
  gastoOverrideByMk: z.record(z.string(), z.number()).optional(),
  priceUpdatedAt: z.string().optional(), // frescura do preço live
  // campos legados (quando não há lots)
  qty:   z.number().optional(),
  gasto: z.number().optional(),
})

export const BolsoSchema = z.object({
  id:             z.string(),
  name:           z.string(),
  valorAtual:     z.number().optional(),
  valorInvestido: z.number().optional(),
  entregas:       z.array(z.object({
    id:     z.string().optional(),
    date:   z.string().optional(),
    amount: z.number(),
    note:   z.string().optional(),
  })).optional(),
  monthData: z.record(z.string(), z.object({
    valorAtual: z.number().optional(),
  })).optional(),
})

// ── Criptomoeda ────────────────────────────────────────────────────

export const CryptoLotSchema = z.object({
  id:      z.string().optional(),
  qty:     z.number(),
  gasto:   z.number().optional(),
  buyDate: z.string().optional(),
})

export const CryptoHoldingSchema = z.object({
  id:     z.string(),
  ticker: z.string(),
  name:   z.string().optional(),
  price:  z.number().optional(),
  lots:   z.array(CryptoLotSchema).optional(),
  monthData: z.record(z.string(), z.object({
    price: z.number().optional(),
  })).optional(),
  // legado
  qty:   z.number().optional(),
  gasto: z.number().optional(),
})

export const CryptoPlatformSchema = z.object({
  id:       z.string(),
  name:     z.string(),
  holdings: z.array(CryptoHoldingSchema),
})

// ── PPR ────────────────────────────────────────────────────────────

export const PPRContribSchema = z.object({
  id:            z.string().optional(),
  mk:            z.string(),
  valorPago:     z.number(),
  valorColocado: z.number(),
  day:           z.number().optional(),
  note:          z.string().optional(),
})

export const PPRAccountSchema = z.object({
  id:            z.string(),
  name:          z.string().optional(),
  balance:       z.number().optional(),
  monthData:     z.record(z.string(), z.object({
    balance: z.number().optional(),
  })).optional(),
  contributions: z.array(PPRContribSchema).optional(),
})

export const PPRPlatformSchema = z.object({
  id:            z.string(),
  name:          z.string(),
  color:         z.string().optional(),
  accounts:      z.array(PPRAccountSchema),
  startMK:       mkOpt,
  deletedFromMK: mkOpt,
  balance:       z.number().optional(),
})

// ── Aforro ─────────────────────────────────────────────────────────

export const AforroProductSchema = z.object({
  id:            z.string(),
  startDate:     z.string().optional(),
  amount:        z.number(),
  notes:         z.string().optional(),
  rateHistory:   z.record(z.string(), z.number()).optional(),
  valueOverride: z.number().nullish(),   // null = sem override; undefined = campo ausente
})

// ── Dívidas ────────────────────────────────────────────────────────
// pagamentos suporta dois formatos:
//   novo:    { mk: [{id, valor, saldoRestante}] }
//   legado:  { mk: {pago: true, valor, saldoRestante} }
// Usa z.any() para o valor porque o union entre array e objeto é difícil de
// discriminar em Zod sem criar ruído desnecessário.

export const DebtSchema = z.object({
  id:              z.string(),
  nome:            z.string(),
  banco:           z.string().optional(),
  montanteInicial: z.number(),
  prestacaoMensal: z.number(),
  diaDebito:       z.number().min(1).max(28).optional(),
  inicioMK:        mkOpt,
  ativa:           z.boolean(),
  pagamentos:      z.record(z.string(), z.any()).optional(),
})

// ── Schema raiz ────────────────────────────────────────────────────

const MonthSnapshotSchema = z.object({
  banco:    z.number().optional(),
  poupanca: z.number().optional(),
  acoes:    z.number().optional(),
  etfs:     z.number().optional(),
  crypto:   z.number().optional(),
  ppr:      z.number().optional(),
  aforro:   z.number().optional(),
})

export const DataSchema = z.object({
  schemaVersion: z.number().optional(),
  version:       z.string().optional(),
  currentYear:   z.number(),
  currentMonth:  z.number().min(0).max(11),

  // Cores das categorias escolhidas em Definicoes -> Aparencia.
  // Parcial: so as categorias alteradas ficam aqui; as restantes usam o
  // default de src/data/categories.js.
  categoryColors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),

  years: z.record(z.string(), z.object({
    goal:         z.number().optional(),
    lockedMonths: z.array(z.number()).optional(),
    months:       z.record(z.string(), MonthSnapshotSchema).optional(),
  })).optional(),

  patrimony: z.object({
    startOfYear: z.number().optional(),
  }).optional(),

  banks: z.object({
    platforms: z.array(BankPlatformSchema),
  }).optional(),

  aforro: z.object({
    euribor:        z.number().optional(),
    euriborUpdated: z.string().nullish(),
    certificates:   z.array(AforroProductSchema).optional(),
  }).optional(),

  crypto: z.object({
    platforms: z.array(CryptoPlatformSchema).optional(),
    years:     z.record(z.string(), z.any()).optional(),
  }).optional(),

  ppr: z.object({
    platforms: z.array(PPRPlatformSchema).optional(),
  }).optional(),

  stocks: z.object({
    acoes:     z.object({ holdings: z.array(HoldingSchema).optional() }).optional(),
    etfs:      z.object({ holdings: z.array(HoldingSchema).optional() }).optional(),
    bolsos:    z.array(BolsoSchema).optional(),
    freeFunds: z.array(z.object({
      id:     z.string(),
      name:   z.string(),
      amount: z.number(),
    })).optional(),
  }).optional(),

  debts: z.array(DebtSchema).optional(),

  debtSettings: z.object({
    showOnDashboard: z.boolean().optional(),
  }).optional(),

  // Perfil do utilizador (benefício fiscal PPR + simulador de englobamento)
  profile: z.object({
    birthYear:       z.number().min(1900).max(2100).optional(),
    taxableIncome:   z.number().min(0).optional(),
    monthlyExpenses: z.number().min(0).optional(),  // fundo de emergência
  }).optional(),

  // Definições de segurança (0 = auto-lock desligado)
  security: z.object({
    autoLockMinutes: z.number().min(0).max(240).optional(),
  }).optional(),

  // Alocação alvo por categoria (percentagens 0–100)
  allocation: z.object({
    targets: z.record(z.string(), z.number().min(0).max(100)).optional(),
  }).optional(),

  // Metas de poupança por objetivo (Dashboard)
  goals: z.array(z.object({
    id:           z.string(),
    nome:         z.string(),
    alvo:         z.number().min(0),
    deadlineMK:   mkOpt,
    categorias:   z.array(z.string()).optional(),
    retornoAnual: z.number().min(0).max(0.5).optional(), // fração/ano (0.07 = 7%)
  })).optional(),

  // Rendimento líquido mensal ({ "YYYY-M": € }) — para a taxa de poupança
  income: z.record(mkString, z.number()).optional(),

  // Parâmetros da página Projeção (+ plano guardado para comparação
  // + linhas comparativas hipotéticas)
  projection: z.object({
    monthlyContribution: z.number().optional(),
    annualReturn:        z.number().optional(),
    target:              z.number().optional(),
    horizonYears:        z.number().optional(),
    showNet:             z.boolean().optional(),
    baseline: z.object({
      savedAt:             z.string().optional(),
      startYear:           z.number(),
      startMonth:          z.number().min(0).max(11),
      initial:             z.number(),
      monthlyContribution: z.number(),
      annualReturn:        z.number(),
    }).optional(),
    scenarios: z.array(z.object({
      id:           z.string(),
      nome:         z.string(),
      color:        z.string().optional(),
      initial:      z.number().min(0).optional(),
      amount:       z.number().min(0).optional(),
      every:        z.number().min(1).optional(),
      unit:         z.enum(['week', 'month', 'year']).optional(),
      annualReturn: z.number().optional(),
      ter:          z.number().min(0).optional(),
      stepUp:       z.number().min(0).optional(),
      hidden:       z.boolean().optional(),
    })).optional(),
  }).optional(),
})

// ── Função de validação ────────────────────────────────────────────
/**
 * Valida `data` contra o DataSchema.
 * Não lança — em caso de erro faz console.warn com os primeiros 10 erros.
 * @param {unknown} data
 * @param {'load'|'save'|string} context  — contexto para a mensagem de log
 * @returns {{ valid: boolean, errors: import('zod').ZodIssue[] }}
 */
export function validateData(data, context = 'unknown') {
  const result = DataSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
    const shown  = issues.slice(0, 10)
    console.warn(
      `[Thrive] Validação falhou (${context}) — ${issues.length} erro(s):`,
      shown.map(i => `${i.path.join('.')}: ${i.message}`)
    )
    if (issues.length > 10) {
      console.warn(`[Thrive] ... e mais ${issues.length - 10} erro(s) omitidos.`)
    }
    return { valid: false, errors: issues }
  }
  return { valid: true, errors: [] }
}
