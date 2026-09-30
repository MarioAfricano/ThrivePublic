// @vitest-environment jsdom
// Teste de componente do fluxo de arranque com dados encriptados:
// PasswordGate → unlock → app desbloqueada. Cobre a regressão em que,
// após o unlock, o flag `encrypted` era posto a false e o efeito de
// persistência voltava a escrever o undo.json (snapshots dos dados em
// texto claro) ao lado do data.json encriptado.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { INITIAL_DATA } from '../data/initialData.js'

const PASSWORD = 'segredo-123'

const api = {
  // Window controls (TitleBar)
  minimize: vi.fn(), maximize: vi.fn(), close: vi.fn(),
  isMaximized: vi.fn(async () => false),
  onWindowStateChange: vi.fn(),
  // Config / dados
  getConfig: vi.fn(async () => ({ dataPath: 'C:/fake', year: 2026 })),
  saveConfig: vi.fn(async (c) => c),
  isDataEncrypted: vi.fn(async () => true),
  readData: vi.fn(async () => null),
  writeData: vi.fn(async () => true),
  dataExists: vi.fn(async () => true),
  listBackups: vi.fn(async () => []),
  readEvents: vi.fn(async () => []),
  readErrors: vi.fn(async () => []),
  logError: vi.fn(async () => true),
  // Encriptação
  unlockData: vi.fn(async (pw) =>
    pw === PASSWORD ? { ok: true, data: INITIAL_DATA } : { ok: false, error: 'Password incorreta' }),
  unlockWithRecovery: vi.fn(async () => ({ ok: false, error: 'Código de recuperação inválido' })),
  enableEncryption: vi.fn(), disableEncryption: vi.fn(), changePassword: vi.fn(),
  // APIs externas (falham silenciosamente — offline)
  fetchExchangeRates: vi.fn(async () => null),
  fetchCryptoPrices: vi.fn(async () => ({})),
  fetchInflation: vi.fn(async () => null),
  fetchStockPrice: vi.fn(async () => null),
  fetchStockHistory: vi.fn(async () => null),
  onAvRateLimit: vi.fn(),
  getApiKeyStatus: vi.fn(async () => ({ alphaVantage: { present: false, source: null } })),
  showSaveDialog: vi.fn(), showOpenDialog: vi.fn(),
}

let App

beforeAll(async () => {
  window.api = api
  // jsdom não tem ResizeObserver (usado pelos gráficos recharts)
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  ;({ default: App } = await import('../App.jsx'))
})

afterEach(cleanup)

async function renderLockedApp() {
  render(<App />)
  // Espera o init assíncrono: com dados encriptados mostra o PasswordGate
  await waitFor(() => expect(screen.getByText('Dados protegidos')).toBeTruthy())
}

function submitPassword(value) {
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value } })
  fireEvent.click(screen.getByText('Desbloquear'))
}

describe('arranque com dados encriptados', () => {
  it('mostra o PasswordGate e rejeita password errada', async () => {
    await renderLockedApp()
    submitPassword('errada')
    await waitFor(() => expect(screen.getByText('Password incorreta')).toBeTruthy())
    // Continua bloqueado
    expect(screen.getByText('Dados protegidos')).toBeTruthy()
  })

  it('desbloqueia com a password certa e sai do gate', async () => {
    await renderLockedApp()
    submitPassword(PASSWORD)
    await waitFor(() => expect(screen.queryByText('Dados protegidos')).toBeNull())
    expect(api.unlockData).toHaveBeenCalledWith(PASSWORD)
  })

  it('após o unlock nunca escreve undo.json (snapshots em texto claro)', async () => {
    api.writeData.mockClear()
    await renderLockedApp()
    submitPassword(PASSWORD)
    await waitFor(() => expect(screen.queryByText('Dados protegidos')).toBeNull())
    // Dá tempo aos efeitos pós-unlock (persistência de histórico, etc.)
    await new Promise(r => setTimeout(r, 50))
    const undoWrites = api.writeData.mock.calls.filter(c => c[0] === 'undo.json')
    expect(undoWrites).toHaveLength(0)
  })
})
