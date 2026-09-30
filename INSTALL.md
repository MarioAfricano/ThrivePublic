# Thrive Finance — Instalação

## Pré-requisitos

1. **Node.js** (versão 18 ou superior)
   Descarrega em: https://nodejs.org
   (escolhe a versão LTS)

2. **Git** (opcional, já tens os ficheiros)

---

## Como iniciar (modo desenvolvimento)

Abre o **Terminal** (PowerShell ou Command Prompt) na pasta `thrive-finance` e executa:

```bash
# 1. Instalar dependências (só uma vez)
npm install

# 2. Iniciar a app em modo desenvolvimento
npm run dev
```

A app abre automaticamente numa janela Windows.

---

## Como compilar para .exe

Para criar um instalador `.exe` que podes instalar como qualquer programa:

```bash
npm run dist
```

O instalador fica em `release/Thrive Finance Setup X.X.X.exe`

---

## Primeira utilização

1. Na primeira vez que abrires a app, vais ver o ecrã de boas-vindas
2. Clica em **"Começar configuração"**
3. Seleciona a tua pasta **OneDrive** (ex: `C:\Users\Mario\OneDrive`)
4. A app cria uma subpasta `ThriveData/` com os teus dados
5. Os teus dados do Excel 2025 já estão pré-carregados!

---

## Estrutura dos dados

Os dados ficam guardados em:
```
[Pasta OneDrive]/
└── ThriveData/
    └── data.json   ← todos os teus dados financeiros
```

O ficheiro `data.json` é legível e editável manualmente se precisares.

---

## Fases do projeto

- ✅ **Fase 1** (atual): Dashboard + Bancos
- 🔜 **Fase 2**: Ações (Degiro + XTB) com preços em tempo real
- 🔜 **Fase 3**: PPR + Aforro + Criptomoeda
- 🔜 **Fase 4**: Edição de dados dentro da app + build final .exe
