# Thrive — invariantes financeiros

Este documento regista as regras de cálculo que os testes em `src/**/*.test.js` validam. É a referência escrita: se algo aqui diverge do código, há um bug — corrige o código ou o documento, mas nunca os deixes em contradição silenciosa.

> Âmbito actual: S3 (Bancos & Câmbios), S4 (Ações & Crypto), S5 (Aforro, Dívidas, PPR).

---

## 1. Convenções gerais

- **Moeda base:** EUR. Todos os totais agregados são em EUR.
- **Month-key (`mk`):** string `"YYYY-M"` com **M em 0-indexed** (`0` = Janeiro, `11` = Dezembro). Ver `src/utils/dateUtils.js`.
- **`input[type=month]`:** formato HTML `"YYYY-MM"` com MM em 1-indexed. Conversão sempre via `mkToMonthInput` / `monthInputToMk`.
- **`mkToNum(mk)`:** `y * 100 + m` (0-indexed) para comparações rápidas. Só comparar mks entre si com `compareMK` ou `mkToNum`; nunca `<` em strings.

---

## 2. Câmbios (`src/utils/currencyUtils.js`)

### 2.1 `toEUR(amount, account, monthData, liveRates)`

Converte `amount` (na moeda de `account`) para EUR.

Ordem de preferência da taxa:

1. Se `account.currency === 'EUR'` (ou ausente) → devolve `amount` sem multiplicação.
2. `liveRates[currency]` (taxa ao vivo do Frankfurter) — **domina** a taxa congelada quando disponível.
3. `monthData.rateToEUR` (taxa guardada no mês).
4. Fallback `1.0`.

**Motivação do ponto 2:** contas em meses **abertos** devem reflectir a taxa actual, mesmo que o `monthData.rateToEUR` já tenha um valor antigo. É `App.jsx` que actualiza o `rateToEUR` nos meses abertos quando o Frankfurter responde.

### 2.2 `resolveRate(currency, { liveRates, monthData, locked })`

Variante explícita que respeita meses **fechados** (`locked = true`):

- `locked: true` → força taxa congelada (`monthData.rateToEUR`), ignorando `liveRates`.
- `locked: false` → igual a `toEUR` (prefere live).

Esta função existe para Banks.jsx, onde a UI precisa de distinguir claramente "mês congelado" vs "mês em actualização ao vivo" — por exemplo para evitar que uma taxa nova sobreponha um valor histórico.

### 2.3 Invariantes

- Nunca aplicar taxa de câmbio sobre um valor já em EUR.
- A taxa guardada em `monthData.rateToEUR` representa EUR por 1 unidade de moeda local.
- `liveRates.EUR === 1.0` por convenção.

---

## 3. Bancos (`src/data/initialData.js` — a mover para `src/utils/calc/bankingCalc.js` em S16)

### 3.1 Visibilidade de conta num mês

`isAccVisible(acc, mk)`:
- Se `mk` for null → conta sempre visível.
- Se `acc.startMK` e `compareMK(startMK, mk) > 0` → conta ainda não criada → invisível.
- Se `acc.deletedFromMK` e `compareMK(deletedFromMK, mk) <= 0` → conta já apagada → invisível.
- Caso contrário → visível.

**Nuance:** `deletedFromMK <= mk` significa que a conta deixa de aparecer **no próprio mês** marcado como eliminação (não no seguinte). `startMK > mk` significa que a conta começa a partir do próprio `startMK`.

### 3.2 Dados da conta num mês — `getAccData(acc, mk)`

- Se existir `acc.monthData[mk]` → devolve-o.
- Senão → devolve os campos de raiz (`balance`, `interest`, `interestHistory`, `rateToEUR`) com os defaults (`0`, `0`, `[]`, `1.0`).

### 3.3 Totais por categoria (tudo para um mês `mk`)

- `calcBancoTotal(platforms, mk, liveRates)` = soma EUR de `d.balance` para contas com `type === 'conta'`, visíveis em `mk`.
- `calcSavingsTotal(platforms, mk, liveRates)` = soma EUR de `d.balance + d.interest` para contas com `type !== 'conta'` (poupanças e poupanças com desconto), visíveis em `mk`.
- `platformTotal(platform, mk, liveRates)` = soma EUR de `d.balance + d.interest` para **todas** as contas visíveis da plataforma. Usado na vista "total da plataforma" do Banks.

**Diferença importante:** `calcBancoTotal` **não inclui juros** (são contas à ordem); `calcSavingsTotal` **inclui**. Verificado por testes.

### 3.4 Bordas de mês (locked vs live)

- Para um mês **fechado**, os dados vêm de `acc.monthData[mk]` e **a taxa de câmbio usada é `monthData.rateToEUR`**. O utilizador vê o valor histórico em EUR exactamente como ficou quando o mês foi fechado.
- Para um mês **aberto**, a taxa ao vivo do Frankfurter **sobrepõe-se** ao `monthData.rateToEUR`. Quando a app arranca e o Frankfurter responde, `App.jsx` reescreve `rateToEUR` nos meses abertos (useEffect em `src/App.jsx:115-151`).

---

## 4. Ações & ETFs (`src/utils/calc/stockCalc.js` + `src/data/initialData.js`)

### 4.1 Modelo de dados

Um `holding` tem `lots[]` (fonte de verdade quando presente) ou, em formatos antigos, `qty`/`gasto` de raiz. Cada `lot` tem:

- `id`, `qty`, `gasto`, `buyMk` (mês da operação).
- Venda parcial: `{ isSell: true, qty: NEGATIVA, sellTotal, buyMk: <mês da venda> }`. A convenção é que `qty` é negativo para que `holdingQtyAtMk` subtraia ao somar. O valor absoluto é o número de unidades vendidas.
- Venda total: gravada no `holding` via `sellMk`, `sellPrice`, `sellQty`, `sellTotal` (sem lot).

### 4.2 Regra do "mês seguinte" em compras

Em `holdingQtyAtMk` / `holdingGastoAtMk`:

- **Compra** com `buyMk = X` só entra no total a partir de `X+1` (`mkToNum(l.buyMk) < cur`).
- **Venda** (sell lot) com `buyMk = X` entra **no próprio mês `X`** (`mkToNum(l.buyMk) <= cur`).

O motivo: uma compra a meio do mês não é material no fecho desse mês; a venda sim — o dinheiro saiu da posição. (Ver testes em `src/data/__tests__/stockHelpers.test.js`.)

### 4.3 Custo médio ponderado — `holdingAdjustedStats(h, mk)`

Usado quando o holding tem sell lots (venda parcial). NÃO é FIFO.

- `avgCost = Σ(compras.gasto, buyMk ≤ mk) / Σ(compras.qty, buyMk ≤ mk)`.
- `realizedProfit = Σ (sellTotal_i − |qty_i| · avgCost)` para cada sell lot com `buyMk ≤ mk`.
- `adjustedGasto = holdingQtyAtMk(h, mk) · avgCost`.

Sem sell lots → `{ adjustedGasto: holdingGastoAtMk(h, mk), realizedProfit: 0 }`.

### 4.4 Override manual — `effectiveGasto(h, mk)`

Se o holding tem `gastoOverrideByMk = { mk: valor, ... }`, o override mais recente com `mk ≤ cur` substitui `adjustedGasto`. Usado quando o utilizador edita manualmente o "Valor pago" de uma linha em meses fechados antigos. Overrides futuros (mk > cur) são ignorados.

### 4.5 Bolsos — `bolsoInvestidoAtMk(bolso, mk)`

Regra dos dias para entregas de bolso de ETF/fundo:

- **Dia 1** (ou sem dia) → entrega conta a partir do próprio mês.
- **Dia > 1** → conta só a partir do mês seguinte.
- Sem `entregas[]` → fallback `bolso.valorInvestido`.
- Sem `mk` → soma todas as entregas.

Exemplo: entrega de 300€ a 2026-02-20 só aparece a partir de Março 2026.

### 4.6 IRS sobre mais-valias — `STOCK_TAX_RATE = 0.28`

Taxa autónoma de 28% sobre **ganho positivo**. `stockTaxDue(netGain)` devolve `netGain > 0 ? netGain · 0.28 : 0`. (Este valor é um indicador, não substitui o cálculo real do IRS: as perdas em activos tributáveis podem ser reportadas, e o englobamento opcional muda o regime. Ver S29–S30 para o relatório IRS-ready.)

---

## 5. Crypto (`src/utils/calc/cryptoCalc.js`)

### 5.1 Regime PT — < 1 ano vs ≥ 1 ano

- `CRYPTO_TAX_FREE_DAYS = 365`. Um lote com `buyDate` há 365 dias ou mais é **isento** (`isLotExempt`).
- Um lote com < 365 dias é **tributável** a `CRYPTO_IRS_RATE = 0.28` sobre o ganho positivo.
- Perdas num lote tributável **não reduzem** `taxableGain` (ficam em 0). O total `totalGain` pode ser negativo mas `taxDue` nunca é negativo.

`holdingTaxBreakdown(h)` devolve:
- `exemptQty/Gasto/Value`, `taxableQty/Gasto/Value/Gain`, `taxDue = max(0, taxableGain · 0.28)`.
- Flags `isFullyExempt`, `isFullyTaxable`, `hasMixed` para a UI (badges ISENTO / IRS 28% / PARCIAL).

### 5.2 FIFO — `simulateSale(h, sellQty, sellPrice)` e `executeSale(h, sellQty, sellPrice)`

Vendas consomem o lote com `buyDate` mais antigo primeiro. Lotes sem `buyDate` ficam no fim (tratados como mais recentes). Para cada porção consumida:

- `unitCost = lot.gasto / lot.qty`; `cost = used · unitCost`; `gain = used · sellPrice − cost`.
- Se o lote é isento → acumula em `exemptGain`.
- Se é tributável **e** `gain > 0` → acumula em `taxableGain`; perdas não entram.
- `taxDue = taxableGain · 0.28`.

`executeSale` devolve os novos lots (lote parcial preservado com `qty` e `gasto` reduzidos proporcionalmente; lote totalmente consumido é eliminado; lotes posteriores intactos). Não muta o holding original.

### 5.3 Regra do mês para lots — `lotMK(lot)`

- `buyDate` dia 1 → o lote conta no próprio mês.
- `buyDate` dia > 1 → conta só no mês seguinte.
- Sem `buyDate` → `null` (conta sempre).

Idêntica à regra de Bolsos em Ações (§4.5) para consistência visual no histórico mensal.

### 5.4 Valor em mês fechado — `holdingValueAtMk(h, mk)`

Usa `h.monthData[mk].price` se existir, senão `h.price` actual. Quantidade e gasto são filtrados por `lotExistsAtMk` (§5.3). Não há conversão de câmbio — o preço guardado já está na moeda base.

---

## 6. Certificados de Aforro (`src/utils/calc/savingsCalc.js`)

### 6.1 Modelo de dados

Um `certificate` tem `amount` (capital), `date` (data de subscrição, `YYYY-MM-DD`), opcional `rateHistory` (`{ [ps]: rate }` onde `ps` é o mês inicial de cada período trimestral — 0, 3, 6, 9, …) e opcional `valueOverride` (valor manual, sobrepõe-se a tudo).

`aforro.euribor` é a taxa Euribor 3M corrente (fallback quando `rateHistory[ps]` não existe para um período).

### 6.2 Tiers de bónus — `AFORRO_TIERS`

Bónus cumulativo com a taxa base, em função dos meses decorridos **no momento em que os juros desse mês são calculados**:

| Meses | Tier    | Bónus |
|-------|---------|-------|
| 0–11  | Ano 1   | 0.00% |
| 12–23 | Ano 2   | 0.25% |
| 24–35 | Ano 3   | 0.50% |
| 36+   | Ano 4+  | 1.00% |

Bordas exactas: no mês 12 já se aplica Ano 2 (inclusivo à esquerda, exclusivo à direita).

### 6.3 Motor de juros — `calcAforroValueFromMonths(cert, euribor, totalMonths)`

1. Se `cert.valueOverride != null` → devolve-o, sem cálculo.
2. `completedMonths = Math.floor(totalMonths / 3) * 3` — só trimestres completos pagam juros; meses parciais do trimestre actual não contam.
3. Para cada mês `m` de `0` a `completedMonths - 1`:
   - `ps = Math.floor(m / 3) * 3` (período trimestral).
   - `rate = cert.rateHistory?.[ps] ?? euribor`.
   - `bonus = getAforroTier(m).bonus`.
   - `interest = round2(interest + amount · (rate + bonus) / 12)`.
4. Total = `round2(amount + interest · (1 - 0.28))` — IRS de 28% **só sobre os juros**, nunca sobre o capital.

O arredondamento a 2 casas decimais **a cada iteração mensal** replica o comportamento do IGCP e é intencional (não substituível por fórmula fechada).

### 6.4 `aforroMonthsAt(date, monthKey, nowMs)`

- Meses decorridos desde `date` até (i) o 1º dia de `monthKey`, ou (ii) `nowMs` se `monthKey` null.
- Usa 30.4375 dias/mês (média). `Math.floor`. Nunca negativo.

### 6.5 `calcAforroTotal(aforro, monthKey, nowMs)`

Soma todos os certificados, **excluindo os subscritos no próprio mês pedido** (regra equivalente ao "mês seguinte" em bolsos/compras): um certificado subscrito a `2026-06-10` não entra no `monthKey = '2026-5'`.

### 6.6 `aforroNextPaymentDate` / `aforroEstimateNextPayment`

- Próximo pagamento = `dateStr + (completedQuarters + 1) × 3 meses`. Se essa data é ≤ agora (coincidência exacta), avança mais 1 trimestre.
- Estimativa de juros do próximo trimestre = `amount · (rate + bonus) / 4 · (1 - 0.28)`, onde `rate = rateHistory[ps] ?? euribor` e `bonus` é o tier vigente.

---

## 7. Dívidas (`src/utils/calc/debtCalc.js`)

### 7.1 Modelo de dados

Um `debt` tem `montanteInicial`, `prestacaoMensal`, opcional `inicioMK`, e `pagamentos: { [mk]: … }`. Cada entrada de `pagamentos[mk]` pode ser:

- **Formato actual (array):** `[ { id, valor, saldoRestante }, … ]` — suporta múltiplos pagamentos no mesmo mês.
- **Formato legacy (objecto):** `{ pago: true, valor, saldoRestante }` — convertido internamente para 1 entrada com `id: 'legacy'`. `{ pago: false }` → `[]`.

`getMonthPayments(debt, mk)` normaliza ambos os formatos.

### 7.2 `getAllPayments(debt, currentMK)`

Devolve todos os pagamentos até (incluindo) `currentMK`, ordenados cronologicamente. Ignora meses futuros — a UI de "histórico" nunca mostra pagamentos adiantados.

### 7.3 `getDebtPayoff(debt, currentMK)`

Indicador simples, **não é uma amortização real**:

- `currentBalance` = `saldoRestante` do último pagamento até `currentMK`, ou `montanteInicial` se não há pagamentos.
- `monthlyRate` = média dos **totais mensais pagos** (múltiplos pagamentos no mesmo mês somam-se antes da média). Meses sem pagamento não contam como zero — são ignorados. Sem histórico → cai em `prestacaoMensal`.
- `monthsLeft` = `Math.ceil(currentBalance / monthlyRate)`. Se rate ≤ 0 → null.
- `payoffYear` / `payoffMonth` = `currentMK + monthsLeft` em calendário (propaga para anos seguintes).
- Saldo zero → `monthsLeft = 0`.

A limitação conhecida: isto não modela juros sobre o saldo devedor nem variação de prestação. Serve como estimativa visual; o cálculo real exigiria plano de amortização francês ou similar.

### 7.4 `buildYearlyChart(debt, currentMK)`

Para o gráfico anual:

- `startYear` = ano de `inicioMK` se definido, senão ano de `currentMK`.
- Para cada ano em `[startYear, payoffYear]` devolve `{ year, actual, projected }` onde `actual` é o `saldoRestante` do último pagamento desse ano (ou `montanteInicial` para o primeiro ano sem pagamentos), e `projected` converge para 0 no `payoffYear`.

---

## 8. PPR (`src/data/initialData.js`)

### 8.1 Visibilidade de plataforma — `isPPRPlatformVisible(p, mk)`

- `mk` null → sempre visível.
- `startMK > mk` → escondida (ainda não existia).
- `deletedFromMK ≤ mk` → escondida **a partir do próprio mês** (não do seguinte). Consistente com `isAccVisible` (§3.1).

### 8.2 Dados da conta num mês — `getPPRAccData(acc, mk)`

- `acc.monthData[mk]` se existir (pode ter `balance` e `rentabilidade`).
- Senão → fallback `{ balance: acc.balance ?? 0 }`.
- `mk` null → `{ balance: acc.balance ?? 0 }`.

### 8.3 Total PPR — `calcPPRTotal(platforms, mk)`

Soma `balance` de todas as contas de todas as plataformas visíveis em `mk`. Usa `getPPRAccData` — respeita override por mês.

### 8.4 Regra dos dias nas contribuições — `isContribActiveForMK(c, mk)`

Cada contribuição tem `mk` (mês alvo) e `day`:

- `day ≤ 1` (ou ausente) → conta **no próprio mês** `c.mk` e seguintes.
- `day > 1` → só conta a partir do mês seguinte a `c.mk`.

Propaga correctamente entre anos (Dez dia 20 → Jan do ano seguinte).

### 8.5 Totais de contribuições — `calcPPRContribTotals(platforms, mk)`

Agrega todas as contribuições activas em `mk`:

- `pago` = Σ `valorPago` (valor que saiu da tua carteira).
- `colocado` = Σ `valorColocado` (valor que entrou no PPR depois de comissões).
- `encargos` = `pago − colocado` (custos do produto).
- `countEntregas` = contribuições com `valorPago > 0`.
- `countLevantamentos` = contribuições com `valorPago < 0`.

`valorPago` negativo representa levantamento — também sujeito à regra dos dias.
