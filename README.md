# Thrive Finance

App de gestão de finanças pessoais, construída com **Electron + React + Vite**.

## Funcionalidades

- **Dashboard** — Vista geral do património com gráficos de evolução mensal, composição por categoria, e comparação desde qualquer mês de referência.
- **Bancos** — Registo de contas à ordem e poupança, suporte a múltiplas moedas com taxas de câmbio em tempo real.
- **Ações & ETFs** — Carteira de ações e ETFs com histórico de lotes, dividendos e cálculo de mais-valias.
- **Criptomoeda** — Portfólio de criptomoedas com preços actualizados automaticamente via CoinGecko, cálculo de IRS (isenção após 1 ano), compra e venda parcial via FIFO.
- **PPR** — Acompanhamento de Planos Poupança Reforma.
- **Aforro** — Certificados de Aforro com cálculo automático de juros trimestrais e bónus de fidelização.
- **Histórico** — Registo de todas as alterações com possibilidade de desfazer.

## Tecnologias

- [Electron](https://www.electronjs.org/) — app desktop cross-platform
- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Recharts](https://recharts.org/) — gráficos
- [Lucide React](https://lucide.dev/) — ícones
- [Tailwind CSS](https://tailwindcss.com/) — estilos utilitários
- [CoinGecko API](https://www.coingecko.com/en/api) — preços de criptomoedas
- [Frankfurter API](https://www.frankfurter.app/) — taxas de câmbio

## Instalação e desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento (Vite + Electron)
npm run dev

# Compilar para produção (Windows)
npm run dist
```

## Estrutura do projecto

```
src/
  pages/          # Páginas principais (Dashboard, Crypto, Banks, etc.)
  components/     # Componentes partilhados (Sidebar, TitleBar)
  context/        # AppContext — estado global da aplicação
  data/           # initialData.js — estrutura de dados e helpers de cálculo
electron/         # Processo principal do Electron
```

## Dados

Os dados são guardados localmente em `data.json` na pasta configurada durante a instalação. Um backup automático (`data-backup.json`) é criado a cada checkpoint manual.

## Licença

Uso pessoal · © Mário Ferreira
