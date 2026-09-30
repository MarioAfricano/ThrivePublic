// ── Infra de migrações do `data.json` ─────────────────────────
// Regra: adicionar uma entrada `{ from, to, migrate }` por cada
// breaking change no formato. `migrate(data)` deve devolver um novo
// objecto (não mutar `data`) já no formato `to`.

export const CURRENT_SCHEMA_VERSION = 1

// v0 → v1: formato pré-versionamento. Contém duas migrações heurísticas
// que historicamente viviam em `App.jsx`.
function v0_to_v1(data) {
  let out = data

  // stocks.holdings (flat) → stocks._unclassified (para triagem manual)
  const old = out.stocks?.holdings
  if (old && Array.isArray(old) && old.length > 0 &&
      !out.stocks?.acoes && !out.stocks?.etfs && !out.stocks?._unclassified) {
    const unclassified = old.map((h, i) => ({
      ...h,
      id: h.id || `legacy-${i}`,
      monthData:  h.monthData  || {},
      dividends:  h.dividends  || [],
      taxaGasto:  h.taxaGasto  || 0,
      currency:   h.currency   || 'EUR',
    }))
    out = {
      ...out,
      stocks: {
        ...out.stocks,
        holdings: undefined,
        _unclassified: unclassified,
        acoes:  out.stocks.acoes  || { holdings: [] },
        etfs:   out.stocks.etfs   || { holdings: [] },
        bolsos: out.stocks.bolsos || [],
      },
    }
  }

  // crypto: formato antigo (totais flat) → { platforms, years }
  if (out.crypto && !Array.isArray(out.crypto?.platforms)) {
    out = {
      ...out,
      crypto: {
        platforms: [],
        years: out.crypto?.years || {},
      },
    }
  }

  return out
}

const MIGRATIONS = [
  { from: 0, to: 1, migrate: v0_to_v1 },
]

// Aplica migrações sequencialmente até `CURRENT_SCHEMA_VERSION`.
// Devolve `{ data, migratedFrom, migratedTo, steps }`.
export function applyMigrations(raw) {
  if (!raw) return { data: raw, migratedFrom: null, migratedTo: null, steps: [] }

  let data = raw
  const startVersion = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0
  let current = startVersion
  const steps = []

  while (current < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find(m => m.from === current)
    if (!step) break // sem path → desiste (preferível a corromper)
    data = step.migrate(data)
    data = { ...data, schemaVersion: step.to }
    steps.push(`${step.from}→${step.to}`)
    current = step.to
  }

  // Assegurar sempre um schemaVersion explícito (mesmo sem migração)
  if (typeof data.schemaVersion !== 'number') {
    data = { ...data, schemaVersion: CURRENT_SCHEMA_VERSION }
  }

  return { data, migratedFrom: startVersion, migratedTo: current, steps }
}
