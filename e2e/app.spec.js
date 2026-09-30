// ── E2E: arranque e navegação da app Electron real ─────────────────
// Lança o Electron com o bundle dist (THRIVE_FORCE_DIST) e um userData
// isolado por teste (THRIVE_USER_DATA) — nunca toca nos dados reais.
import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

async function launchApp({ withData = false } = {}) {
  const userData = tmpDir('thrive-e2e-user-')
  if (withData) {
    // Configura uma pasta de dados com um data.json mínimo válido
    const dataRoot = tmpDir('thrive-e2e-data-')
    fs.mkdirSync(path.join(dataRoot, 'ThriveData'), { recursive: true })
    fs.writeFileSync(path.join(dataRoot, 'ThriveData', 'data.json'), JSON.stringify({
      schemaVersion: 3,
      currentYear: 2026, currentMonth: 6,
      years: { 2026: { goal: 10000, lockedMonths: [], months: {} } },
      banks: { platforms: [] },
      stocks: { acoes: { holdings: [] }, etfs: { holdings: [] }, bolsos: [], freeFunds: [] },
      crypto: { platforms: [], years: {} },
      ppr: { platforms: [] },
      aforro: { certificates: [] },
      debts: [],
    }, null, 2))
    fs.writeFileSync(path.join(userData, 'thrive-config.json'),
      JSON.stringify({ dataPath: dataRoot, year: 2026 }))
  }
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, THRIVE_USER_DATA: userData, THRIVE_FORCE_DIST: '1' },
  })
  const win = await app.firstWindow()
  return { app, win }
}

test('arranque sem configuração mostra o ecrã de boas-vindas', async () => {
  const { app, win } = await launchApp()
  await expect(win.getByText('Bem-vindo ao Thrive')).toBeVisible({ timeout: 20_000 })
  await app.close()
})

test('com dados configurados abre o Dashboard', async () => {
  const { app, win } = await launchApp({ withData: true })
  // currentMonth 6 = Julho — título do Dashboard
  await expect(win.getByRole('heading', { name: /Julho/ })).toBeVisible({ timeout: 20_000 })
  await app.close()
})

test('navegação pela sidebar chega à Projeção e à Carteira', async () => {
  const { app, win } = await launchApp({ withData: true })
  await expect(win.getByRole('heading', { name: /Julho/ })).toBeVisible({ timeout: 20_000 })

  await win.getByRole('button', { name: 'Projeção', exact: true }).click()
  await expect(win.getByText('Crescimento projetado do património', { exact: false })).toBeVisible({ timeout: 10_000 })

  await win.getByRole('button', { name: 'Carteira' }).click()
  await expect(win.getByText('Todas as posições em Ações e ETFs')).toBeVisible({ timeout: 10_000 })

  await app.close()
})
