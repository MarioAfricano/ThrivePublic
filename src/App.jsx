import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { AppContext } from './context/AppContext.jsx'
const _logos = import.meta.glob('./assets/logo.{png,svg,jpg,jpeg,ico,webp}', { eager: true })
const appLogoSrc = Object.values(_logos)[0]?.default ?? null
import TitleBar from './components/TitleBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import Setup from './pages/Setup.jsx'
import { INITIAL_DATA, DEFAULT_GOAL, getMK, calcBancoTotal, calcSavingsTotal, calcPPRTotal, calcHoldingsTotal, calcBolsosTotal, calcAforroTotal, calcCryptoTotal } from './data/initialData.js'
import { applyMigrations } from './data/migrations.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Páginas carregadas sob demanda: cada uma vira um chunk próprio no
// build — o arranque só carrega a página inicial (Dashboard).
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Banks     = lazy(() => import('./pages/Banks.jsx'))
const PPR       = lazy(() => import('./pages/PPR.jsx'))
const Acoes     = lazy(() => import('./pages/Acoes.jsx'))
const Carteira  = lazy(() => import('./pages/Carteira.jsx'))
const History   = lazy(() => import('./pages/History.jsx'))
const Aforro    = lazy(() => import('./pages/Aforro.jsx'))
const Crypto    = lazy(() => import('./pages/Crypto.jsx'))
const Dividas   = lazy(() => import('./pages/Dividas.jsx'))
const Saude     = lazy(() => import('./pages/Saude.jsx'))
const Projecao  = lazy(() => import('./pages/Projecao.jsx'))
const Security  = lazy(() => import('./pages/Security.jsx'))
const Settings  = lazy(() => import('./pages/Settings.jsx'))
const IRS       = lazy(() => import('./pages/IRS.jsx'))
import NetworkToast from './components/NetworkToast.jsx'
import InboxWatcher from './components/InboxWatcher.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import { toastBus } from './utils/toastBus.js'
import { useExchangeRates, RATES_REFRESH_MS } from './hooks/useExchangeRates.js'
import { computeUpcomingEvents, buildEventsNotification } from './utils/upcomingEvents.js'
import { useCryptoPrices } from './hooks/useCryptoPrices.js'
import { useUndoableState } from './hooks/useUndoableState.js'
import { validateData } from './schemas/index.js'

// Etiqueta legível para cada tipo de alteração
const CHANGE_LABELS = {
  banks: 'Bancos', ppr: 'PPR', stocks: 'Ações',
  crypto: 'Criptomoeda', aforro: 'Aforro',
  years: 'Dados anuais', patrimony: 'Património',
  debts: 'Dívidas', debtSettings: 'Dívidas',
  profile: 'Perfil', projection: 'Projeção',
  allocation: 'Alocação', income: 'Rendimento',
  security: 'Segurança', goals: 'Metas',
  categoryColors: 'Cores das categorias',
}
function detectLabel(updates) {
  const keys = Object.keys(updates).filter(k => k !== 'currentYear' && k !== 'currentMonth')
  if (!keys.length) return null // navegação pura — não guardar no histórico
  return keys.map(k => CHANGE_LABELS[k] || k).join(', ')
}

const isElectron = typeof window !== 'undefined' && !!window.api

// Chaves de dados financeiros — quando mudam, gera instantâneo do mês actual
const FINANCIAL_KEYS = ['banks', 'stocks', 'crypto', 'ppr', 'aforro']

// Corre a pipeline de migrações sobre os dados carregados.
// As migrações estão definidas em `src/data/migrations.js` e correm de forma
// idempotente sequencialmente até à versão actual.
function migrateData(raw) {
  if (!raw) return null
  const { data, migratedFrom, migratedTo, steps } = applyMigrations(raw)
  if (steps.length) console.info(`[Thrive] Dados migrados: v${migratedFrom} → v${migratedTo} (${steps.join(', ')})`)
  return data
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [config, setConfig] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [setupDone, setSetupDone] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [encrypted, setEncrypted] = useState(false)
  const dataRef    = useRef(null)
  const configRef  = useRef(null)
  // eslint-disable-next-line react-hooks/refs
  dataRef.current    = data
  // eslint-disable-next-line react-hooks/refs
  configRef.current  = config

  // Persiste um estado nos dois destinos (sem tocar no histórico nem no dirty)
  // `label` opcional: usado para o event log em Electron.
  const _persist = useCallback(async (state, label) => {
    if (isElectron && configRef.current?.dataPath) {
      const ok = await window.api.writeData('data.json', state, label ? { label } : undefined)
      if (!ok) toastBus.emit('Erro ao guardar no disco — as últimas alterações podem não estar gravadas.')
    } else {
      try { localStorage.setItem('thrive-dev-data', JSON.stringify(state)) } catch {} // eslint-disable-line no-empty
    }
  }, [])

  // Histórico + undo: restauração delega para setData+isDirty+persist
  const handleRestore = useCallback((state, reason) => {
    dataRef.current = state
    setData(state)
    setIsDirty(true)
    _persist(state, reason)
  }, [_persist])
  const { history, pushSnapshot, undoLast, undoTo, restoreHistory } = useUndoableState({
    onRestore: handleRestore,
  })

  // Taxas de câmbio EUR-base; null antes de carregar.
  // O hook volta a buscar sozinho a cada RATES_REFRESH_MS.
  const { rates: exchangeRates, updatedAt: ratesUpdatedAt } = useExchangeRates(setData)

  // Fetcher de preços cripto (CoinGecko)
  const { fetchCryptoPrices, cryptoPricesLoading } =
    useCryptoPrices({ dataRef, configRef, setData })

  // Refresh periódico dos preços cripto com a app aberta (silencioso —
  // os câmbios têm o seu próprio intervalo dentro de useExchangeRates).
  useEffect(() => {
    const iv = setInterval(() => {
      if (dataRef.current) fetchCryptoPrices(undefined, { silent: true })
    }, RATES_REFRESH_MS)
    return () => clearInterval(iv)
  }, [fetchCryptoPrices])

  // Aviso global quando o check de arranque encontra versão nova
  // (a instalação faz-se em Definições → Atualizações)
  useEffect(() => {
    if (!isElectron || !window.api?.onUpdateStatus) return
    window.api.onUpdateStatus(s => {
      if (s?.state === 'available') {
        toastBus.emit(`Nova versão ${s.version} disponível — Definições → Atualizações`)
      }
    })
  }, [])

  // Toast nativo do Windows com eventos a ≤3 dias — no máximo 1×/dia
  // (marca o dia apenas quando notifica; dias sem eventos voltam a verificar).
  useEffect(() => {
    if (loading || !data || !isElectron || !window.api?.notify) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem('thrive-last-notify') === today) return
      const n = buildEventsNotification(computeUpcomingEvents(data, new Date(), 3))
      if (n) {
        window.api.notify(n)
        localStorage.setItem('thrive-last-notify', today)
      }
    } catch { /* localStorage indisponível — segue sem notificar */ }
  }, [loading, data])

  useEffect(() => {
    async function init() {
      let loadedData = null
      if (isElectron) {
        const cfg = await window.api.getConfig()
        setConfig(cfg)
        if (cfg.dataPath) {
          const isEnc = await window.api.isDataEncrypted()
          if (isEnc) {
            setEncrypted(true)
            setSetupDone(true)
            setLoading(false)
            return
          }
          const savedData = await window.api.readData('data.json')
          loadedData = migrateData(savedData) || INITIAL_DATA
          validateData(loadedData, 'load')
          setData(loadedData)
          const savedUndo = await window.api.readData('undo.json')
          if (Array.isArray(savedUndo) && savedUndo.length) restoreHistory(savedUndo)
          setSetupDone(true)
        }
      } else {
        setConfig({ dataPath: '/dev', year: 2025 })
        try {
          const saved = localStorage.getItem('thrive-dev-data')
          loadedData = migrateData(saved ? JSON.parse(saved) : null) || INITIAL_DATA
          validateData(loadedData, 'load')
          setData(loadedData)
        } catch {
          loadedData = INITIAL_DATA
          setData(INITIAL_DATA)
        }
        setSetupDone(true)
      }
      setLoading(false)
      // Buscar preços cripto ao arrancar (depois de carregar os dados)
      if (loadedData) fetchCryptoPrices(loadedData)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- one-time init, fetchCryptoPrices/restoreHistory are stable

  const [paletteOpen, setPaletteOpen] = useState(false)

  // Keyboard shortcuts: Ctrl+K (palette), Ctrl+Z (undo), Ctrl+1..9 (páginas)
  const PAGE_KEYS = ['dashboard', 'banks', 'stocks', 'carteira', 'crypto', 'ppr', 'savings', 'dividas', 'saude']
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  useEffect(() => {
    function onKey(e) {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (e.key === 'k') { e.preventDefault(); setPaletteOpen(o => !o) }
      if (e.key === 'z' && !e.shiftKey) {
        // Não interceptar o undo nativo de campos de texto em edição
        const t = e.target
        const editing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
        if (!editing) { e.preventDefault(); undoLast() }
      }
      const digit = parseInt(e.key)
      if (digit >= 1 && digit <= PAGE_KEYS.length) { e.preventDefault(); setPage(PAGE_KEYS[digit - 1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoLast]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quota do Alpha Vantage esgotada (detectado no main process) → toast
  useEffect(() => {
    window.api?.onAvRateLimit?.(() =>
      toastBus.emit('Limite de pedidos do Alpha Vantage atingido — preços de ações indisponíveis por agora.'))
  }, [])

  // Auto-lock por inatividade (só com encriptação ativa e desbloqueada):
  // descarta a DEK no main, limpa o histórico de undo (snapshots em
  // memória) e volta ao PasswordGate. 0 = desligado.
  const unlocked = encrypted && !!data
  const autoLockMinutes = data?.security?.autoLockMinutes ?? 15
  useEffect(() => {
    if (!isElectron || !unlocked || !autoLockMinutes) return
    let lastActivity = Date.now()
    const bump = () => { lastActivity = Date.now() }
    const events = ['mousemove', 'keydown', 'mousedown', 'wheel']
    events.forEach(ev => window.addEventListener(ev, bump, { passive: true }))
    const timer = setInterval(() => {
      if (Date.now() - lastActivity >= autoLockMinutes * 60000) {
        window.api.lockSession?.()
        restoreHistory([])
        setData(null) // encrypted && !data → PasswordGate
        toastBus.emit('Sessão bloqueada por inatividade.')
      }
    }, 30000)
    return () => { events.forEach(ev => window.removeEventListener(ev, bump)); clearInterval(timer) }
  }, [unlocked, autoLockMinutes, restoreHistory])

  // Persist undo history to disk (skip when encrypted — snapshots contain
  // plaintext data). O guard de `loading` evita escrever durante o init.
  // Dieta de I/O: em memória ficam 50 snapshots, mas o disco só recebe os
  // últimos 10, com debounce de 1,5s — antes, cada edição reescrevia até
  // 50 cópias completas dos dados.
  useEffect(() => {
    if (loading || !isElectron || !config?.dataPath || encrypted) return
    const t = setTimeout(() => { window.api.writeData('undo.json', history.slice(-10)) }, 1500)
    return () => clearTimeout(t)
  }, [history, config?.dataPath, encrypted, loading])

  async function handleUnlock(password, isRecovery = false) {
    const result = isRecovery
      ? await window.api.unlockWithRecovery(password)
      : await window.api.unlockData(password)
    if (result.ok) {
      const migrated = migrateData(result.data) || INITIAL_DATA
      validateData(migrated, 'load')
      setData(migrated)
      // `encrypted` mantém-se true: significa "encriptação ativa", não "bloqueado".
      // O gate desaparece porque `data` deixa de ser null. Pôr isto a false
      // faria o efeito do undo.json voltar a escrever snapshots em texto claro.
      fetchCryptoPrices(migrated)
    }
    return result
  }

  async function handleSetupComplete(folderPath) {
    const newConfig = { dataPath: folderPath, year: new Date().getFullYear() }
    if (isElectron) {
      await window.api.saveConfig(newConfig)
      await window.api.writeData('data.json', INITIAL_DATA)
    }
    setConfig(newConfig)
    setData(INITIAL_DATA)
    setSetupDone(true)
  }

  const saveData = useCallback(async (updates) => {
    // Merge superficial sobre o estado mais recente (dataRef, não a closure do
    // render): duas chamadas a saveData no mesmo tick não se perdem uma à outra.
    const current = dataRef.current
    const merged = { ...current, ...updates }

    // Guardar snapshot no histórico (só para alterações reais, não navegação)
    const label = detectLabel(updates)
    if (label) pushSnapshot(label, current)

    // Auto-instantâneo: quando há mudanças de dados financeiros,
    // recalcula os totais de cada categoria e guarda para o mês actual.
    // Invariante: meses fechados (lockedMonths) preservam o snapshot congelado
    // — nunca recalcular com live rates, senão o valor histórico muda.
    const hasFinancial = FINANCIAL_KEYS.some(k => Object.prototype.hasOwnProperty.call(updates, k))
    if (hasFinancial) {
      const now       = new Date()
      const year      = merged.currentYear  ?? now.getFullYear()
      const month     = merged.currentMonth ?? now.getMonth()
      const monthKey  = getMK(year, month)
      const prevYears = merged.years   || {}
      const prevYear  = prevYears[year] || { goal: DEFAULT_GOAL, lockedMonths: [], months: {} }
      const isLocked  = (prevYear.lockedMonths || []).includes(month)

      if (!isLocked) {
        const liveRates = exchangeRates
        const snap = {
          banco:    calcBancoTotal(merged.banks?.platforms || [], monthKey, liveRates),
          poupanca: calcSavingsTotal(merged.banks?.platforms || [], monthKey, liveRates),
          acoes:    calcHoldingsTotal(merged.stocks?.acoes?.holdings, monthKey, liveRates),
          etfs:     calcHoldingsTotal(merged.stocks?.etfs?.holdings, monthKey, liveRates) + calcBolsosTotal(merged.stocks?.bolsos, monthKey),
          crypto:   calcCryptoTotal(merged.crypto, monthKey),
          ppr:      calcPPRTotal(merged.ppr?.platforms || [], monthKey),
          aforro:   calcAforroTotal(merged.aforro, monthKey),
        }
        merged.years = {
          ...prevYears,
          [year]: {
            ...prevYear,
            months: { ...prevYear.months, [month]: snap },
          },
        }
      }
    }

    validateData(merged, 'save')
    // Actualizar o ref de imediato: a próxima chamada a saveData (antes do
    // re-render) já parte deste estado, não do anterior.
    dataRef.current = merged
    setData(merged)
    setIsDirty(true)
    // Auto-save de crash protection — passa o label ao event log quando houver
    await _persist(merged, label || undefined)
  }, [exchangeRates, pushSnapshot, _persist])

  // Substitui todos os dados (import JSON). Persiste imediatamente.
  const importData = useCallback(async (newData) => {
    dataRef.current = newData
    setData(newData)
    await _persist(newData, 'Importação de dados JSON')
    setIsDirty(false)
    fetchCryptoPrices(newData)
  }, [_persist, fetchCryptoPrices])

  // Checkpoint manual: força um save imediato e limpa o dirty flag.
  // (backups rotativos já são escritos em cada save atómico no main process.)
  const persistData = useCallback(async () => {
    const current = dataRef.current
    if (!current) return
    if (isElectron && configRef.current?.dataPath) {
      const ok = await window.api.writeData('data.json', current, { label: 'Checkpoint manual' })
      if (!ok) {
        toastBus.emit('Erro ao guardar no disco — o checkpoint não foi gravado.')
        return // mantém o dirty flag: a gravação falhou
      }
    } else {
      try { localStorage.setItem('thrive-dev-data', JSON.stringify(current)) } catch {} // eslint-disable-line no-empty
    }
    setIsDirty(false)
  }, [])

  // Memoizado: sem isto, cada render de App criava um objecto novo e forçava
  // re-render de todos os consumidores do contexto.
  const contextValue = useMemo(() => ({
    data, saveData, persistData, importData, isDirty, config, page, setPage,
    exchangeRates, ratesUpdatedAt, history, undoLast, undoTo, fetchCryptoPrices,
    cryptoPricesLoading, encrypted, setEncrypted,
  }), [
    data, saveData, persistData, importData, isDirty, config, page,
    exchangeRates, ratesUpdatedAt, history, undoLast, undoTo, fetchCryptoPrices,
    cryptoPricesLoading, encrypted,
  ])

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
        <div style={{ textAlign:'center' }}>
          {appLogoSrc
            ? <img src={appLogoSrc} alt="Thrive" style={{ width:40, height:40, borderRadius:10, margin:'0 auto 16px', display:'block', objectFit:'contain' }} />
            : <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#818cf8,#6366f1)', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'#fff' }}>T</div>
          }
          <p style={{ color:'#52525b', fontSize:'0.875rem' }}>A carregar...</p>
        </div>
      </div>
    )
  }

  if (!setupDone) {
    return <Setup onComplete={handleSetupComplete} />
  }

  if (encrypted && !data) {
    return <PasswordGate onUnlock={handleUnlock} />
  }

  const pages = { dashboard: Dashboard, banks: Banks, stocks: Acoes, carteira: Carteira, crypto: Crypto, ppr: PPR, savings: Aforro, history: History, irs: IRS, dividas: Dividas, saude: Saude, projecao: Projecao, security: Security, settings: Settings }
  const PageComponent = pages[page] || Dashboard

  return (
    <AppContext.Provider value={contextValue}>
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>
        <TitleBar />
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          <Sidebar />
          <main id="main-scroll" style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>
            <div key={page} className="page-enter">
              <ErrorBoundary name={`page:${page}`} variant="page">
                <Suspense fallback={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    A carregar…
                  </div>
                }>
                  <PageComponent />
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <NetworkToast />
      <InboxWatcher />
      {paletteOpen && <CommandPalette onClose={closePalette} />}
    </AppContext.Provider>
  )
}
