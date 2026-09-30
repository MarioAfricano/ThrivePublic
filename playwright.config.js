import { defineConfig } from '@playwright/test'

// E2E sobre a app Electron real (bundle dist + THRIVE_FORCE_DIST).
// Correr com `npm run test:e2e` — faz o build primeiro.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,          // uma instância Electron de cada vez
  retries: 0,
  reporter: [['list']],
})
