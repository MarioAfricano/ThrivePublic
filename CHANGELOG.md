# Changelog

Todas as alterações notáveis deste projecto são registadas neste ficheiro.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projecto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.21.0] - 2026-08-30

### Added

- **Cores das categorias configuráveis** em Definições → Aparência. Um
  seletor por categoria, com repor individual e repor todas. A escolha
  propaga-se à Evolução Mensal, Composição Mensal, ao donut de Alocação e
  à lista de categorias do Dashboard. Fica guardada com os dados (e nos
  backups), não presa ao dispositivo; só as categorias alteradas são
  gravadas, para que uma futura mudança da paleta por omissão chegue a
  quem nunca personalizou.
- **Modo "Todas" no gráfico de Evolução Mensal.** O par de botões
  Total / Todas mostra as 7 categorias em simultâneo, cada uma na sua cor
  e com legenda. O Total fica de fora deste modo: sendo a soma, é várias
  vezes maior e esmagaria as categorias contra o eixo. O tooltip passa a
  listar as categorias por valor decrescente, com a soma no fim.

### Changed

- As categorias (ids, rótulos e cores) passam a viver num único módulo,
  `src/data/categories.js`. Antes as cores estavam em dois sítios que já
  divergiam — a ordem de pilhagem do gráfico de composição e um array
  inline no Dashboard.

## [1.20.0] - 2026-08-30

### Added

- **Data da venda escolhível.** O popover de venda passa a ter um seletor
  de mês e ano. Antes a venda era sempre registada no mês activo da app,
  o que obrigava a navegar até esse mês para registar uma venda passada.
  Agora dá para estar em Setembro e marcar a venda em Agosto: a posição
  desaparece de Setembro e continua a aparecer até Agosto, inclusive.
  Não aceita meses anteriores à primeira compra.

### Fixed

- **Tecto de 2,50% da Euribor nos Certificados de Aforro (Série F).** A
  taxa base entrava no cálculo sem limite. Enquanto a Euribor 3M estiver
  abaixo de 2,50% não há diferença, mas acima disso a app projectava juros
  superiores aos que o IGCP paga. O bónus de permanência acumula POR CIMA
  do tecto, como no produto real: no Ano 4+ a taxa efectiva é 3,50%.
  O tecto aplica-se também às taxas introduzidas à mão, por ser regra do
  produto e não da origem do número. Quando está a actuar, o cartão do
  certificado mostra-o explicitamente.
- **Popovers e modais fugiam com o scroll.** `.page-enter` usava
  `animation-fill-mode: both`, o que deixa o último keyframe (um
  `transform`) aplicado permanentemente. Um `transform` num antepassado
  cria um bloco de contenção para descendentes `position: fixed`, por isso
  estes ficavam fixos em relação à página e não ao ecrã. Passa a
  `backwards`: mesma animação, sem transform residual.
- **O popover de venda saltava ao abrir.** O `autoFocus` do campo de preço
  levava o browser a fazer scroll para o trazer à vista, arrastando a
  página inteira. Passa a `focus({ preventScroll: true })`.
- O popover de venda podia ficar cortado pelo fundo do ecrã quando aberto
  numa linha em baixo; agora ajusta-se para caber.

## [1.19.0] - 2026-08-30

### Fixed

- **Reordenar posições na Carteira nunca gravava.** `applyDragReorder`
  fazia duas gravações seguidas (`saveAcoes` e depois `saveEtfs`) e ambas
  partiam do mesmo estado da closure, por isso a segunda repunha a ordem
  antiga das ações e anulava a primeira. Passa a ser uma única gravação.
- **Contraste do texto secundário.** `--text-muted` estava a 2,2:1 sobre
  os cartões — menos de metade do mínimo WCAG AA — e era usado nas labels
  dos KPI, cabeçalhos de tabela e metadados. Sobe para 5,1:1 no tema
  escuro e 5,3:1 no claro.
- **Não se conseguia copiar valores.** O `user-select: none` era global;
  passa a aplicar-se só ao chrome e aos controlos.
- Contagem de posições na Carteira mostrava "3 posiçãoões".

### Added

- **Navegação por teclado na Carteira**: ordenar colunas com Tab+Enter
  (os cabeçalhos eram `<th onClick>`, inalcançáveis sem rato) e reordenar
  linhas com as setas na pega de cada linha.
- **Estado de foco visível** em toda a app (`:focus-visible`). Não existia
  nenhum definido.
- Suporte a `prefers-reduced-motion`, `color-scheme` e `theme-color`.

### Changed

- Percentagens passam a usar `Intl.NumberFormat` em pt-PT: `+26,3 %` em
  vez de `+26.3%`.
- O arrastar de linhas na Carteira faz-se pela pega, não pela linha
  inteira — o browser marca qualquer elemento `draggable` como
  não-selecionável, o que bloqueava a cópia dos valores.
- Cores hardcoded (`#ef4444`, `#fbbf24`, `#4ade80`) passam a tokens, para
  respeitarem o tema claro.
- Rótulos para leitores de ecrã (`aria-label`, `aria-sort`, `aria-pressed`,
  `aria-live`), `<label>` nos selects e `inputMode="decimal"` nos campos
  numéricos.

## [1.18.0] - 2026-08-30

### Added

- **Linhas comparativas na Projeção**: além da trajetória do património
  real, a página passa a aceitar cenários hipotéticos ilimitados — cada
  um com investimento inicial, reforço periódico (a cada X semanas,
  meses ou anos), retorno anual esperado, TER do ETF e aumento anual do
  reforço. Todos são desenhados no mesmo gráfico, contra a meta, e cada
  linha pode ser renomeada, mudar de cor, ser ocultada do gráfico ou
  apagada (com Ctrl+Z). Serve para comparar estratégias antes de
  decidir: 100 €/semana vs. 400 €/mês, TER 0,07% vs. 0,50%, reforço
  fixo vs. a crescer com o salário.
- **Tabela de marcos**: valor e total investido a 1/3/5/7/10/15/20/25
  anos (ajustada ao horizonte), com o "Património real" como primeira
  linha para comparação directa. Toggle "Líquido de imposto (28%)"
  aplica a tributação de mais-valias, e com uma meta definida ganha uma
  coluna que diz quanto tempo cada estratégia demora a atingi-la.
- `src/utils/calc/etfSimCalc.js` — cálculo puro dos cenários
  (capitalização mensal, cadências semanais/mensais/anuais, TER,
  step-up, imposto). 17 testes novos (total: 490).

### Fixed

- **Campos de percentagem aceitam decimais**: o `EditableField`
  arredondava o valor para inteiro ao abrir a edição — 2,5% reabria
  como 3%, e voltar a gravar perdia a casa decimal. Afetava todos os
  campos percentuais da app (taxas de juro, retornos, TER).

## [1.17.0] - 2026-07-18

### Added

- **Pasta Inbox — importação automática com preview**: larga extratos
  XTB (.xlsx) em `ThriveData/Inbox` e, ao arrancar (ou via Definições →
  Importar → "Verificar agora"), a app abre a preview com TODAS as
  operações linha a linha — compra/venda/dividendo, mês, valores — cada
  uma com checkbox. Desmarca o que não quiseres; linhas já importadas
  aparecem bloqueadas ("já importado"); tickers novos têm escolha de
  categoria e só são criados se as suas linhas ficarem marcadas —
  tickers existentes recebem as operações como novos lotes/dividendos.
  Vários ficheiros sobrepostos são fundidos sem duplicados (srcId).
  Após importar, os extratos são movidos para `Inbox/importados`
  (nunca apagados); "Mais tarde" deixa tudo como está e volta a propor
  no próximo arranque. IPC novo: `list-inbox`, `read-inbox-file`,
  `archive-inbox-file`, `open-inbox-folder` (nomes sempre saneados).
  `collectSrcIds` em `importXtb.js`. 2 testes novos (total: 472 + 3 E2E).

## [1.16.2] - 2026-07-18

### Changed

- **Atualização silenciosa**: "Reiniciar e instalar" passa a correr o
  instalador em modo silencioso (`quitAndInstall(true, true)`) — a app
  fecha, atualiza em fundo e reabre sozinha, sem assistente NSIS
  visível. (O pedido de permissões do Windows/UAC pode ainda aparecer,
  dependendo de onde a app está instalada.)

## [1.16.1] - 2026-07-18

### Fixed

- **Feedback nos botões de atualização** (Definições → Atualizações):
  "Verificar agora" mostra spinner enquanto verifica; "Descarregar"
  mostra de imediato a barra de progresso ("a ligar…" até chegar o
  primeiro evento, depois %); "Reiniciar e instalar" fica em
  "A reiniciar…" ao clicar. Antes os cliques ficavam sem resposta
  visível durante os primeiros segundos.

## [1.16.0] - 2026-07-18

### Changed

- **Fecho de mês unificado em todo o lado**: os botões "Fechar mês" /
  "Abrir mês" das páginas Bancos, Ações e Cripto passam a fechar/reabrir
  o mês nos três sistemas de lock de uma vez (antes cada página só
  fechava o seu — o helper unificado existia mas só era usado pelo
  lembrete e pela paleta Ctrl+K). Fechar na página Cripto continua a
  congelar os preços em `monthData`, agora preservando snapshots já
  existentes; reabrir nunca apaga snapshots congelados. Tooltips dos
  botões indicam o âmbito. Novo `buildUnlockMonthPatch` em
  `lockMonth.js`. 4 testes novos (total: 470 + 3 E2E).

## [1.15.0] - 2026-07-15

### Added

- **Ritmo das metas por aportes reais**: em vez da variação de valor
  (que mistura poupança com mercado), o ritmo passa a medir o dinheiro
  que entrou de facto — compras − vendas de ações/ETFs (lotes), entregas
  de bolsos, contribuições PPR, certificados de aforro subscritos e
  compras cripto; banco/poupança continuam pela variação dos snapshots
  (não têm fluxos registados). Coerente com o retorno esperado: os
  reforços são teus, o crescimento é do mercado — sem dupla contagem.
  A linha diz «reforços ~X€/mês» (fallback «ritmo» quando não há fluxos
  mensuráveis). `goalContributionPace` em `goalCalc.js`.
- **Atualizações automáticas** (Definições → Atualizações): a app
  instalada procura versões novas nas GitHub Releases do repo privado
  ao arrancar (aviso em toast) e sob pedido, com download e "Reiniciar
  e instalar" com um clique. Requer um token fine-grained (só o repo
  Thrive, Contents read/write) colado uma vez nas Definições — fica em
  `thrive-config.json`, local. electron-updater; IPC `check-updates`/
  `download-update`/`install-update`; config `build.publish` (GitHub).
- 6 testes novos. Total: 466 + 3 E2E.

## [1.14.0] - 2026-07-15

### Added

- **Previsão de chegada nas metas**: cada meta mostra o teu ritmo real
  (variação média mensal das categorias da meta nos últimos 6 meses de
  snapshots) e a data prevista de chegada ao alvo a esse ritmo — verde
  "✓ dentro do prazo", amarelo "depois do prazo" ou vermelho "assim não
  chegas". Respeita o retorno esperado da meta (composto).
  `goalActualPace` e `monthsToReach` em `goalCalc.js`.
- **Notificações do Windows**: ao abrir a app com eventos a ≤3 dias
  (débitos de dívidas, juros do aforro, maturidades, prazo PPR), aparece
  um toast nativo com até 4 linhas — no máximo uma vez por dia.
  Handler IPC `show-notification` com `Notification` do Electron e
  `app.setAppUserModelId`.
- **Evolução anual dos dividendos** (Carteira → secção Dividendos):
  barras por ano com total e crescimento % face ao ano anterior
  (ano em curso assinalado como incompleto). `dividendsByYear` em
  `dividendCalc.js`.
- **Comparação ano a ano** (Dashboard): novo cartão que põe o último
  fecho de dois anos lado a lado, categoria a categoria, com Δ em € e %
  e total — anos selecionáveis; só aparece com ≥2 anos de snapshots.
  `yearCompareCalc.js` (puro, testado).
- 21 testes novos. Total: 460 + 3 E2E.

## [1.13.0] - 2026-07-14

### Added

- **Retorno esperado nas metas de poupança**: cada meta pode assumir um
  retorno anual (ex.: 7%/ano para ETFs mundiais — campo na engrenagem
  da meta). O ritmo necessário passa da divisão linear para a fórmula
  da anuidade com capitalização mensal: o valor atual e os reforços
  crescem ao retorno esperado, por isso metas de ações/ETFs pedem
  reforços mensais realistas (menores). Quando o crescimento sozinho
  chega ao alvo dentro do prazo, o cartão diz "a X%/ano chegas lá sem
  reforços ✓". `requiredMonthlyContribution` em `goalCalc.js`;
  `retornoAnual` no schema (0–50%). 6 testes novos (total: 439 + 3 E2E).

## [1.12.0] - 2026-07-14

### Added

- **Poupança média por mês** no cartão "Taxa de poupança" do Dashboard:
  (total atual − snapshot de dezembro do ano anterior) ÷ meses decorridos
  — quanto o património cresceu em média por mês este ano, em €. Sem o
  snapshot de dezembro usa o primeiro snapshot do ano; tooltip indica o
  período usado. Como a taxa de poupança, inclui valorização de mercado
  (aproximação, não contabilidade de fluxos). `avgMonthlySavings` em
  `utils/calc/incomeCalc.js`, com 4 testes novos (total: 433 + 3 E2E).

## [1.11.0] - 2026-07-14

### Added

- **Metas de poupança por objetivo** (Dashboard): cria objetivos com
  nome, alvo em € e prazo opcional («Entrada para casa — 20.000€ até
  dez 2028»), medidos contra o valor ao vivo das categorias escolhidas
  (chips Poupança/Aforro/Ações/…; vazio = todo o património). Mostra
  barra de progresso, quanto falta e o **ritmo necessário em €/mês**
  para cumprir o prazo; assinala metas atingidas e prazos expirados.
  Cálculo puro em `utils/calc/goalCalc.js`, dados em `data.goals`.
- **Refresh periódico de câmbios e preços cripto**: com a app aberta,
  as taxas Frankfurter e os preços CoinGecko voltam a atualizar-se a
  cada 30 minutos (antes: só ao arrancar ou manualmente). Os refreshes
  de fundo falham em silêncio (log apenas) para não gerar toasts de
  erro repetidos offline. O cabeçalho do Dashboard indica a hora da
  última atualização de câmbios.

### Changed

- `useExchangeRates` devolve `{ rates, updatedAt }` (antes só o mapa);
  novo `ratesUpdatedAt` no AppContext.
- 12 testes novos (goalCalc). Total: 429 + 3 E2E.

## [1.10.0] - 2026-07-14

### Added

- **Import de extratos XTB (.xlsx)** (Definições → Importar): lê os dois
  formatos que a XTB exporta (zip anual com "Cash Operations"/"Closed
  Positions" e statement mensal) e cria automaticamente compras (lotes
  com mês e preço, incluindo execuções parciais), vendas (com o valor
  recebido exato por lote) e dividendos (agregados por dia, líquidos e
  com a retenção na fonte registada). Preview por ticker com escolha da
  categoria para tickers novos. **Dedupe por `srcId`**: reimportar o
  mesmo ficheiro ou ficheiros sobrepostos não duplica nada. Validado
  contra extratos reais (107 compras, 24 vendas, 12 dividendos, zero
  avisos; reimportação: 143/143 ignorados).
- **Fundo de emergência** (Dashboard): despesas mensais → meses de vida
  cobertos pela liquidez (banco + poupança + aforro), alvo de 6 meses
  com barra de progresso e "quanto falta".
- **Próximos eventos** (Dashboard): lista cronológica dos próximos 90
  dias — débitos de dívidas, juros trimestrais do aforro (com valor
  estimado), maturidades de certificados e o prazo da dedução PPR.
- `show-open-dialog` aceita leitura binária (base64) para .xlsx.
- 18 testes novos (parser XTB nos dois formatos, dedupe, merge; runway;
  eventos). Total: 417 + 3 E2E.

## [1.9.0] - 2026-07-07

### Added

- **Tema claro** (Definições → Aparência): preferência por dispositivo,
  aplicada via variáveis CSS. Os ~110 tons hardcoded de branco-alfa
  foram convertidos em variáveis (`--wa-*`) que invertem no tema claro;
  o escuro continua pixel-perfect igual. Acentos de gráficos mantêm-se.
- **UI de restauro de backups** (Definições → Backups diários): lista
  os últimos 30 snapshots com data legível; restaurar tem confirmação
  em dois cliques e recarrega a app (com encriptação volta ao gate).
- **Validação do schema na página Saúde**: novo check `schema-validation`
  — os erros Zod que antes morriam na consola aparecem agora com o
  caminho do campo.

### Changed

- **`undo.json` em dieta**: em memória continuam 50 snapshots, mas o
  disco só recebe os últimos 10, com debounce de 1,5s — antes cada
  edição reescrevia até 50 cópias completas dos dados.
- Fallbacks `2025`/`dezembro` substituídos pela data corrente em todas
  as páginas; objetivo anual por defeito centralizado em `DEFAULT_GOAL`.

## [1.8.0] - 2026-07-07

### Added

- **Export Excel para o IRS** (botão "Excel (Anexo G)" na página IRS):
  ficheiro .xlsx com o histórico COMPLETO — todos os anos com vendas —
  pensado como arquivo de longo prazo. Quatro folhas:
  · **Vendas**: uma linha por realização (parcial ou total) com ano/mês
    da venda, quantidade, valor de realização, valor de aquisição (PMP),
    taxas registadas (coluna própria, como as "despesas e encargos" do
    Anexo G), mais/menos-valia, IRS estimado a 28% e líquido, mais o mês
    da 1.ª aquisição.
  · **Dividendos**: bruto, retenção e líquido por ano.
  · **Resumo**: totais anuais + total global.
  · **Notas**: mapeamento campo-a-campo para o quadro 9 do Anexo G,
    método usado e regras relevantes (englobamento, <365 dias).
- As linhas de mais-valias (`collectStockCapitalGains`) passaram a
  incluir `firstBuyMk` (1.ª aquisição) e `fees` (taxas proporcionais).
- `show-save-dialog` aceita conteúdo binário (base64) — usado pelo .xlsx.
- Biblioteca xlsx carregada sob demanda (chunk lazy próprio).

## [1.7.0] - 2026-07-07

Fecho do capítulo de segurança (itens 9–11 da auditoria).

### Added

- **Ver código de recuperação** (página Segurança): revela o código
  mediante confirmação da password — para quem perdeu o registo
  original. Sem password não há acesso.
- **Bloqueio automático por inatividade**: com encriptação ativa, a
  sessão bloqueia após N minutos parada (15 por defeito; configurável
  0/5/15/30/60 na Segurança). Descarta a chave da memória, limpa o
  histórico de undo e volta ao ecrã de password.
- **Logs de auditoria encriptados**: com encriptação ativa, cada linha
  do `events.log` e `errors.log` é cifrada com a DEK (legível na app,
  ilegível no disco). Ativar/desativar a encriptação limpa os logs
  para não misturar linhas claras e cifradas.

### Fixed

- `write-data` recusa escrever `data.json` em claro por cima de um
  ficheiro encriptado quando a sessão está bloqueada — impossível
  corromper o modo de encriptação por uma escrita tardia.

## [1.6.1] - 2026-07-07

Correções dos quatro problemas 🔴 da auditoria pós-1.6.0.

### Fixed

- **Câmbio aplicado nos totais de ações/ETFs.** `calcHoldingValue`
  ignorava a moeda — posições em USD entravam nos totais do Dashboard,
  snapshots, Projeção e Alocação como se fossem EUR. Agora converte
  (taxa congelada > live > 1.0) em todos os pontos de agregação.
- **Câmbio congelado em meses fechados (ações).** Como os bancos já
  faziam: o `useExchangeRates` grava `rateToEUR` nos snapshots de meses
  abertos, o fecho guarda a taxa do momento, e a linha da posição usa a
  taxa congelada quando o mês está fechado — o valor EUR histórico
  deixa de mexer com o câmbio de hoje.
- **Fecho de mês unificado nas ações rápidas.** O lembrete e o comando
  da paleta fecham agora os três sistemas de lock (global/bancos, ações
  e crypto, com snapshot de preço crypto) — antes só fechavam o global
  e o mês ficava meio-fechado. O lembrete dispara enquanto qualquer um
  dos três estiver aberto.

### Added

- **Frescura de preços**: botão "Atualizar preços" no cabeçalho das
  Ações (o preço live não tinha nenhuma via de atualização em massa),
  `priceUpdatedAt` registado em cada atualização, e um ponto âmbar na
  linha da posição quando o preço tem mais de 7 dias (tooltip com a
  idade exata).
- 12 testes novos (FX 6, lock unificado 6). Total: 385 + 3 E2E.

## [1.6.0] - 2026-07-07

### Added

- **Dividendos na Carteira**: calendário mensal do ano, rendimento dos
  últimos 12 meses (± €/mês) e posições pagadoras com yield-on-cost.
- **Plano vs. real**: botão "Guardar como plano" na Projeção; um cartão
  novo no Dashboard mostra o esperado hoje, o real e o desvio.
- **Benchmark justo**: card "vs. S&P 500 (mesmos fluxos)" na Carteira —
  XIRR que o índice teria dado com as tuas compras/vendas/dividendos
  nas tuas datas (sem efeito cambial, avisado).
- **Ações rápidas nos lembretes**: "Fechar mês" e "Registar prestação"
  com um clique, com os mesmos patches que a UI das páginas faria.
- **Ctrl+Z global** (desfazer a última alteração, sem interferir com a
  edição de texto) e **comandos na paleta Ctrl+K**: desfazer, guardar
  checkpoint e fechar o mês anterior; página Projeção adicionada.
- **Testes E2E (Playwright)** sobre a app Electron real: arranque sem
  configuração (Setup), arranque com dados (Dashboard) e navegação —
  com userData isolado por teste (`THRIVE_USER_DATA`) e bundle dist
  forçado (`THRIVE_FORCE_DIST`). `npm run test:e2e`.
- 14 testes unitários novos. Total: 373 + 3 E2E.

### Changed

- **Lazy-loading das páginas**: cada página é agora um chunk próprio —
  o chunk principal desceu de ~500 kB para ~135 kB.

## [1.5.0] - 2026-07-06

### Added

- **Alocação alvo e rebalanceamento** (Dashboard): define percentagens
  alvo por categoria e vê o desvio atual e quanto mover em € ("reforçar
  X" / "reduzir Y"; desvios <1 p.p. contam como equilibrados). Botão de
  arranque preenche os alvos a partir da distribuição atual. Alvos em
  `data.allocation.targets`; cálculos em `utils/calc/allocationCalc.js`.
- **Taxa de poupança mensal** (Dashboard): regista o rendimento líquido
  do mês (`data.income[mk]`) e vê a taxa do mês (Δ património /
  rendimento) e o agregado dos últimos 12 meses (Σ deltas / Σ
  rendimentos). Com a ressalva explícita de que o Δ inclui valorização
  de mercado. Cálculos em `utils/calc/incomeCalc.js`.
- **Relatório anual (HTML)** nas Definições: ficheiro autónomo e pronto
  a imprimir (browser → PDF) com o património por mês, evolução do ano,
  rendimentos/mais-valias com IRS estimado e entregas/dedução do PPR.
  Gerado por `utils/annualReport.js` (função pura, testada).
- 18 testes novos. Total: 359.

### Fixed

- CSP de produção passou a permitir `data-api.ecb.europa.eu` — desde a
  v1.2.0 bloqueava o fetch da Euribor 3M na página Aforro (ficava a
  taxa guardada, sem atualização).

## [1.4.0] - 2026-07-06

### Added

- **Lembretes no Dashboard** (banner dispensável no topo): mês anterior
  com snapshot por fechar; certificados de aforro a menos de 6 meses da
  maturidade ou já vencidos (série E/F inferida pela data de subscrição:
  10/15 anos); teto do benefício fiscal PPR por aproveitar (outubro–
  dezembro); prestações de dívida sem registo depois do dia de débito.
  Cada lembrete navega para a página respetiva. Lógica pura e testada
  em `utils/reminders.js`.
- **Simulador "englobar ou taxa autónoma?"** na página IRS: compara os
  28% com o englobamento das mais-valias de ações/ETFs nas taxas gerais
  (tabela 2025 do continente, método das fatias), dado o rendimento
  coletável anual (guardado em `data.profile.taxableIncome`). Mostra
  taxa efetiva, veredito e poupança. Notas sobre englobamento
  obrigatório (<365 dias, último escalão) e reporte de menos-valias.
- **Check de saúde novo**: lotes de ações/ETFs sem mês de compra
  (`buyMk`) — sem data, o XIRR da Carteira e os totais históricos ficam
  imprecisos. Aparece na página Saúde com o caminho de cada lote.
- 31 testes novos (lembretes, escalões/englobamento, check de lotes).

## [1.3.0] - 2026-07-06

Três funcionalidades de análise e fiscalidade.

### Added

- **Benefício fiscal do PPR** (cartão na página PPR): dedução à coleta
  estimada — 20% das entregas do ano com teto por idade (400 €/350 €/300 €),
  barra de progresso até ao investimento útil e "quanto falta para
  maximizar". Pede o ano de nascimento na primeira utilização (guardado
  em `data.profile.birthYear`). Cálculos em `utils/calc/pprTaxCalc.js`.
- **Página Projeção** (nova entrada no menu, ícone foguetão): projeta o
  património total com juros compostos e contribuição mensal, em três
  cenários de retorno (∓2 p.p.), com linha de poder de compra descontada
  à inflação HICP média e estimativa de "quando atinjo a meta" (+ regra
  dos 4%). Sugere a contribuição a partir do crescimento médio do
  histórico. Parâmetros persistidos em `data.projection`.
- **TIR anual (XIRR)** na Carteira: retorno anualizado ponderado pelas
  datas de todos os fluxos — compras, vendas parciais e totais,
  dividendos e valor de mercado das posições activas. Implementação por
  bissecção em `utils/calc/xirrCalc.js`.
- 45 testes novos (xirr, benefício fiscal, projeção, render das UIs).

## [1.2.0] - 2026-07-03

Ciclo de segurança e robustez: correção de fugas no fluxo de encriptação,
hardening do Electron e das APIs externas, e limpeza geral. Sem alterações
que quebrem dados existentes.

### Fixed

- **Encriptação — fuga de dados em texto claro.** Após desbloquear, o
  `undo.json` (snapshots completos dos dados) voltava a ser escrito em texto
  claro ao lado do `data.json` encriptado, e a página Segurança mostrava
  "Sem proteção" com a encriptação ativa. O flag `encrypted` passou a
  significar "encriptação ativa" e mantém-se após o unlock.
- **Encriptação — restos em claro.** Ativar a encriptação agora encripta os
  backups diários pré-existentes e apaga o `undo.json`; desativar devolve os
  backups a texto claro enquanto a chave ainda existe. Os handlers de unlock
  limpam qualquer `undo.json` residual de versões antigas.
- **`restore-backup`** valida compatibilidade: um backup em texto claro
  restaurado numa sessão encriptada é re-encriptado (antes, o save seguinte
  corrompia os campos KEK e a password deixava de funcionar); um backup
  encriptado é recusado numa sessão sem encriptação.
- **Falhas de gravação deixaram de ser silenciosas** — toast de erro quando
  o `writeData` falha (saves, checkpoint manual, preços cripto).
- **`saveData`** faz merge sobre o estado mais recente (`dataRef`) — duas
  gravações no mesmo tick já não perdem a primeira.
- **APIs externas:** respostas HTTP não-2xx tratadas como falha (um erro 429
  do CoinGecko era cacheado como resposta válida); respostas `Note` do
  Alpha Vantage (quota do tier gratuito) detectadas, com aviso na app.
- Fallbacks do auto-instantâneo deixaram de assumir 2025/dezembro.

### Added

- **Testes do fluxo de encriptação** (13 testes de integração dos handlers
  IPC) e **testes de componente do arranque encriptado** (PasswordGate →
  unlock, incluindo a regressão do `undo.json`).
- **Aviso de quota do Alpha Vantage** — toast quando o limite diário esgota.

### Changed

- **Hardening Electron:** `sandbox: true`, bloqueio de `window.open` e de
  navegação externa, whitelist de ficheiros no IPC (sem path traversal),
  e CSP injetada no build de produção.
- **Fonte Inter empacotada localmente** (`@fontsource/inter`) — a app deixa
  de depender do Google Fonts e funciona 100% offline.
- **Code splitting** dos vendors (react, recharts, lucide) — o chunk
  principal desce de ~1,1 MB para uma fração.
- `HoldingRow.jsx` dividido: `SellPopover.jsx` e `LotsPanel.jsx`.
- Lint a zero warnings; `coverage/` fora do controlo de versões.

## [1.1.0] - 2026-04-18

Ciclo de consolidação: auditoria financeira, unificação de UI e robustez de runtime.
Nenhuma mudança quebra dados existentes — os ficheiros em `ThriveData/` continuam a
ser lidos sem migração manual.

### Added

- **Página Saúde** (nova entrada no menu, ícone `Heart`, entre *Dívidas* e
  *Histórico*). Sete invariantes automáticas de dados — meses futuros sem
  snapshots, IDs únicos, quantidades agregadas de ações/crypto coerentes com
  movimentos, proibição de vendas acima do que existe, câmbios guardados em
  meses locked, snapshots de meses locked imutáveis. Cada check com severidade
  (`info`/`warn`/`error`) e botão **Corrigir** quando há fix automático.
- **Error Boundaries** por página e por gráfico (`src/components/ErrorBoundary.jsx`).
  Três variantes: `page` (ecrã completo com stack trace e *copiar detalhe*),
  `chart` (placeholder compacto no lugar do gráfico com "tentar novamente") e
  `bare` (silencioso). Aplicado em `App.jsx` a todas as páginas e aos
  4 gráficos principais do Dashboard + gráfico das Dívidas.
- **Log de erros do renderer** em `ThriveData/errors.log` (JSONL, rotação a 2 MB),
  alimentado pelos *boundaries* via IPC (`log-error` / `read-errors`). Separado
  do event log para facilitar *debug* de crashes.
- **`EditableField` unificado** (`src/components/ui/EditableField.jsx`) com API
  consistente (`type`, `size`, `formatter`, `onTab`, `forwardRef` → `startEdit()`).
  Zero componentes de edição inline duplicados no projecto.
- **Página Saúde** no Sidebar + **versão visível** no rodapé do Sidebar,
  populada pelo `__APP_VERSION__` definido em `vite.config.js` a partir do
  `package.json`.
- **Suite de testes Vitest** (~206 testes em 10 ficheiros) cobrindo
  `bankingCalc`, `stockCalc` (FIFO, custo médio, IRS 28%), `cryptoCalc`,
  `savingsCalc` (juros compostos, regra dos dias), `debtCalc` (`getDebtPayoff`),
  helpers PPR e `healthChecks`.
- **`CHANGELOG.md`** (este ficheiro) a formalizar o histórico das sessões S1–S9.

### Changed

- **Escrita atómica** dos ficheiros de dados: `tmp` + `fsync` + `rename` para
  evitar corrupção em caso de crash/queda de energia a meio de uma escrita.
- **Backups** rotativos em `ThriveData/backups/` (10 versões por ficheiro).
- **Event log** consolidado em `ThriveData/events.log` (JSONL, rotação 2 MB).
- **Helpers centralizados** em `src/utils/`: `id.js` (uid unificado), `dateUtils.js`
  (month keys, comparação), `currencyUtils.js` (`toEUR`, locked FX), `format.js`
  (`formatEuro`, percentagens). Call-sites migrados em todas as páginas.
- **API Alpha Vantage** agora lida de `ThriveData/secrets.json`, fora do repo,
  acessível via UI de Definições.
- **`schemaVersion`** gravada em todos os ficheiros de dados para migrações
  futuras.

### Fixed

- `defaultFormat` em `EditableField.jsx` devolvia `''` para `type="currency"` com
  valor `null`; agora delega em `formatEuro(value)` e mostra `—`.
- `Acoes.jsx` linha 260: chave `display` duplicada no objecto de estilo inline
  (warning do Vite, sem impacto visual); removida a declaração redundante.
- Vários bugs menores detectados pela suite de auditoria S3–S5 (documentados no
  `IMPROVEMENT_PLAN.md`).

## [1.0.0] - 2026-03

Primeira versão estável usada em produção pessoal. App Electron + React + Vite
com páginas Dashboard, Bancos, Ações & ETFs, Carteira, Criptomoeda, PPR, Aforro,
Dívidas e Histórico. Dados guardados localmente em `ThriveData/`.

[1.1.0]: #110---2026-04-18
[1.0.0]: #100---2026-03
