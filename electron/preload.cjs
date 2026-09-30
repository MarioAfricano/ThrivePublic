const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChange: (cb) => ipcRenderer.on('window-state-change', (_, data) => cb(data)),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // API keys
  getApiKeyStatus: () => ipcRenderer.invoke('api-key-status'),
  setAlphaVantageKey: (key) => ipcRenderer.invoke('set-alpha-vantage-key', key),

  // Folder
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Data
  readData: (filename) => ipcRenderer.invoke('read-data', filename),
  writeData: (filename, data, meta) => ipcRenderer.invoke('write-data', filename, data, meta),
  dataExists: (filename) => ipcRenderer.invoke('data-exists', filename),
  listBackups: (filename) => ipcRenderer.invoke('list-backups', filename),
  restoreBackup: (backupName, targetFilename) => ipcRenderer.invoke('restore-backup', backupName, targetFilename),
  readEvents: (limit) => ipcRenderer.invoke('read-events', limit),

  // Stock prices (Alpha Vantage via Node — no CORS)
  fetchStockPrice: (ticker) => ipcRenderer.invoke('fetch-stock-price', ticker),
  fetchStockHistory: (ticker, range) => ipcRenderer.invoke('fetch-stock-history', ticker, range),
  onAvRateLimit: (cb) => ipcRenderer.on('av-rate-limit', () => cb()),

  // Exchange rates (Frankfurter via Node — evita CORS em dev)
  fetchExchangeRates: () => ipcRenderer.invoke('fetch-exchange-rates'),

  // Inflação HICP Portugal (Eurostat via Node — evita CORS em dev)
  fetchInflation: () => ipcRenderer.invoke('fetch-inflation'),

  // Preços crypto (CoinGecko via Node — evita CORS em dev)
  fetchCryptoPrices: (ids) => ipcRenderer.invoke('fetch-crypto-prices', ids),

  // Pasta Inbox (importação automática de extratos)
  listInbox:        () => ipcRenderer.invoke('list-inbox'),
  readInboxFile:    (name) => ipcRenderer.invoke('read-inbox-file', name),
  archiveInboxFile: (name) => ipcRenderer.invoke('archive-inbox-file', name),
  openInboxFolder:  () => ipcRenderer.invoke('open-inbox-folder'),

  // Notificação nativa (toast Windows) — próximos eventos
  notify: (payload) => ipcRenderer.invoke('show-notification', payload),

  // Auto-update (GitHub Releases privadas; token nas Definições)
  getAppVersion:  () => ipcRenderer.invoke('get-app-version'),
  checkUpdates:   () => ipcRenderer.invoke('check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate:  () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, data) => cb(data)),

  // Error log (ErrorBoundary → ThriveData/errors.log)
  logError: (payload) => ipcRenderer.invoke('log-error', payload),
  readErrors: (limit) => ipcRenderer.invoke('read-errors', limit),

  // Export / Import dialogs
  showSaveDialog: (opts) => ipcRenderer.invoke('show-save-dialog', opts),
  showOpenDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),

  // Encryption
  isDataEncrypted: () => ipcRenderer.invoke('is-data-encrypted'),
  enableEncryption: (password) => ipcRenderer.invoke('enable-encryption', password),
  unlockData: (password) => ipcRenderer.invoke('unlock-data', password),
  unlockWithRecovery: (code) => ipcRenderer.invoke('unlock-with-recovery', code),
  disableEncryption: (password) => ipcRenderer.invoke('disable-encryption', password),
  changePassword: (oldPass, newPass) => ipcRenderer.invoke('change-password', oldPass, newPass),
  getRecoveryCode: (password) => ipcRenderer.invoke('get-recovery-code', password),
  lockSession: () => ipcRenderer.invoke('lock-session'),
})
