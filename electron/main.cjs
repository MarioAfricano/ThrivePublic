const { app, BrowserWindow, ipcMain, dialog, Notification, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// Hooks para testes E2E (Playwright): userData isolado por teste e
// carregar o bundle dist mesmo sem estar empacotado (sem Vite dev server).
if (process.env.THRIVE_USER_DATA) app.setPath('userData', process.env.THRIVE_USER_DATA)

// Identidade dos toasts do Windows (senão as notificações não aparecem
// ou saem como "electron.app.Electron" em dev). Optional: o stub de
// testes não implementa este método.
app.setAppUserModelId?.('com.thrive.finance')

const isDev = !app.isPackaged && !process.env.THRIVE_FORCE_DIST
const configPath = path.join(app.getPath('userData'), 'thrive-config.json')

let mainWindow
let appConfig = { dataPath: null, year: new Date().getFullYear() }

// ── Encryption (AES-256-GCM + scrypt) ───────────────────────────
// Two-layer key scheme:
//   KEK = scrypt(password, salt) — encrypts the DEK
//   DEK = random 32 bytes       — encrypts the data payload
// Recovery code = DEK as hex (user stores offline; bypasses password).
// On unlock, DEK is cached in memory for transparent re-encryption on save.

let _sessionDek = null  // Buffer(32) | null

function _deriveKek(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 32, { N: 1 << 14, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  )
}

function _gcmEncrypt(plaintext, key) {
  const iv  = crypto.randomBytes(12)
  const cip = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct  = Buffer.concat([cip.update(plaintext), cip.final()])
  return { iv: iv.toString('hex'), tag: cip.getAuthTag().toString('hex'), ciphertext: ct.toString('hex') }
}

function _gcmDecrypt(iv, tag, ciphertext, key) {
  const dec = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
  dec.setAuthTag(Buffer.from(tag, 'hex'))
  return Buffer.concat([dec.update(Buffer.from(ciphertext, 'hex')), dec.final()])
}

function _formatRecoveryCode(dek) {
  const hex = dek.toString('hex').toUpperCase()
  return hex.match(/.{8}/g).join(' ') // 8 groups of 8 chars
}

function _buildEncryptedPayload(existingKekFields, data, dek) {
  const encData = _gcmEncrypt(typeof data === 'string' ? data : JSON.stringify(data, null, 2), dek)
  return JSON.stringify({
    encrypted: true, version: 1,
    kek_salt: existingKekFields.kek_salt,
    kek_iv: existingKekFields.kek_iv, kek_tag: existingKekFields.kek_tag,
    encrypted_dek: existingKekFields.encrypted_dek,
    iv: encData.iv, tag: encData.tag, ciphertext: encData.ciphertext,
  }, null, 2)
}

// O undo.json guarda snapshots completos dos dados em texto claro — quando a
// encriptação está (ou passa a estar) ativa, tem de desaparecer do disco.
function _deleteUndoFile(dirPath) {
  try { fs.rmSync(path.join(dirPath, 'undo.json'), { force: true }) } catch {}
}

// Ao ativar a encriptação, os backups diários já existentes ficaram em texto
// claro — converte-os para o formato encriptado com a mesma DEK/KEK.
function _encryptExistingBackups(dirPath, kekFields, dek) {
  try {
    const backupsDir = path.join(dirPath, 'backups')
    if (!fs.existsSync(backupsDir)) return
    for (const name of fs.readdirSync(backupsDir)) {
      if (!name.endsWith('.json')) continue
      const full = path.join(backupsDir, name)
      try {
        const raw = fs.readFileSync(full, 'utf8')
        if (JSON.parse(raw).encrypted === true) continue
        atomicWriteFile(full, _buildEncryptedPayload(kekFields, raw, dek))
      } catch (e) {
        console.warn(`[Thrive] Backup ${name} não encriptado (ilegível):`, e.message)
      }
    }
  } catch (e) {
    console.warn('[Thrive] Falhou encriptação de backups antigos:', e.message)
  }
}

// Simétrico: ao desativar a encriptação, devolve os backups a texto claro
// (senão ficariam ilegíveis para sempre — a DEK é descartada).
function _decryptExistingBackups(dirPath, dek) {
  try {
    const backupsDir = path.join(dirPath, 'backups')
    if (!fs.existsSync(backupsDir)) return
    for (const name of fs.readdirSync(backupsDir)) {
      if (!name.endsWith('.json')) continue
      const full = path.join(backupsDir, name)
      try {
        const enc = JSON.parse(fs.readFileSync(full, 'utf8'))
        if (enc.encrypted !== true) continue
        const plain = _gcmDecrypt(enc.iv, enc.tag, enc.ciphertext, dek).toString('utf8')
        JSON.parse(plain) // valida antes de sobrepor
        atomicWriteFile(full, plain)
      } catch (e) {
        // DEK diferente (ciclo enable/disable anterior) ou ficheiro corrompido — deixa estar
        console.warn(`[Thrive] Backup ${name} não desencriptado:`, e.message)
      }
    }
  } catch (e) {
    console.warn('[Thrive] Falhou desencriptação de backups:', e.message)
  }
}

// Apaga os logs de auditoria (events/errors) — chamado nas transições
// de modo de encriptação, para não misturar linhas claras e cifradas.
function _deleteLogs(dirPath) {
  for (const name of ['events.log', 'errors.log']) {
    try { fs.rmSync(path.join(dirPath, name), { force: true }) } catch {}
  }
}

// Linha de log: cifrada com a DEK quando há sessão encriptada, senão JSON claro.
function _encodeLogLine(payload) {
  if (!_sessionDek) return JSON.stringify(payload)
  const enc = _gcmEncrypt(JSON.stringify(payload), _sessionDek)
  return JSON.stringify({ enc: 1, iv: enc.iv, tag: enc.tag, ct: enc.ciphertext })
}

// Devolve o payload de uma linha (clara ou cifrada); null se não for legível.
function _decodeLogLine(line) {
  let parsed
  try { parsed = JSON.parse(line) } catch { return null }
  if (parsed?.enc === 1) {
    if (!_sessionDek) return null
    try { return JSON.parse(_gcmDecrypt(parsed.iv, parsed.tag, parsed.ct, _sessionDek).toString('utf8')) }
    catch { return null }
  }
  return parsed
}

ipcMain.handle('is-data-encrypted', () => {
  if (!appConfig.dataPath) return false
  try {
    const raw = fs.readFileSync(path.join(appConfig.dataPath, 'ThriveData', 'data.json'), 'utf8')
    return JSON.parse(raw).encrypted === true
  } catch { return false }
})

// Mostra o código de recuperação (= DEK) mediante confirmação da password.
ipcMain.handle('get-recovery-code', async (_, password) => {
  if (!appConfig.dataPath) return { ok: false, error: 'Sem pasta de dados' }
  const filePath = path.join(appConfig.dataPath, 'ThriveData', 'data.json')
  try {
    const enc = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!enc.encrypted) return { ok: false, error: 'Dados não estão encriptados' }
    const kek = await _deriveKek(password, Buffer.from(enc.kek_salt, 'hex'))
    const dek = _gcmDecrypt(enc.kek_iv, enc.kek_tag, enc.encrypted_dek, kek)
    return { ok: true, code: _formatRecoveryCode(dek) }
  } catch { return { ok: false, error: 'Password incorreta' } }
})

// Bloqueia a sessão: descarta a DEK da memória (o renderer volta ao gate).
ipcMain.handle('lock-session', () => {
  _sessionDek = null
  return true
})

ipcMain.handle('enable-encryption', async (_, password) => {
  if (!appConfig.dataPath) return { ok: false, error: 'Sem pasta de dados configurada' }
  const filePath = path.join(appConfig.dataPath, 'ThriveData', 'data.json')
  if (!fs.existsSync(filePath)) return { ok: false, error: 'data.json não encontrado' }
  try {
    const rawFile = fs.readFileSync(filePath, 'utf8')
    const existing = JSON.parse(rawFile)
    if (existing.encrypted) return { ok: false, error: 'Dados já estão encriptados' }
    const dek     = crypto.randomBytes(32)
    const salt    = crypto.randomBytes(32)
    const kek     = await _deriveKek(password, salt)
    const encDek  = _gcmEncrypt(dek, kek)
    const kekFields = {
      kek_salt: salt.toString('hex'),
      kek_iv: encDek.iv, kek_tag: encDek.tag, encrypted_dek: encDek.ciphertext,
    }
    atomicWriteFile(filePath, _buildEncryptedPayload(kekFields, rawFile, dek))
    // Sem isto ficavam restos em texto claro no disco: os backups diários
    // antigos, o undo.json (snapshots completos) e os logs de auditoria.
    const dirPath = path.dirname(filePath)
    _encryptExistingBackups(dirPath, kekFields, dek)
    _deleteUndoFile(dirPath)
    _deleteLogs(dirPath)
    _sessionDek = dek
    return { ok: true, recoveryCode: _formatRecoveryCode(dek) }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('unlock-data', async (_, password) => {
  if (!appConfig.dataPath) return { ok: false, error: 'Sem pasta de dados' }
  const filePath = path.join(appConfig.dataPath, 'ThriveData', 'data.json')
  try {
    const enc  = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!enc.encrypted) return { ok: false, error: 'Ficheiro não está encriptado' }
    const kek  = await _deriveKek(password, Buffer.from(enc.kek_salt, 'hex'))
    const dek  = _gcmDecrypt(enc.kek_iv, enc.kek_tag, enc.encrypted_dek, kek)
    const data = JSON.parse(_gcmDecrypt(enc.iv, enc.tag, enc.ciphertext, dek).toString('utf8'))
    _sessionDek = dek
    _deleteUndoFile(path.dirname(filePath)) // limpa undo.json em texto claro deixado por versões antigas
    return { ok: true, data }
  } catch { return { ok: false, error: 'Password incorreta' } }
})

ipcMain.handle('unlock-with-recovery', async (_, recoveryCode) => {
  if (!appConfig.dataPath) return { ok: false, error: 'Sem pasta de dados' }
  const filePath = path.join(appConfig.dataPath, 'ThriveData', 'data.json')
  try {
    const enc    = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!enc.encrypted) return { ok: false, error: 'Ficheiro não está encriptado' }
    const hexStr = recoveryCode.replace(/[\s\-]/g, '').toUpperCase()
    if (hexStr.length !== 64 || !/^[0-9A-F]+$/.test(hexStr)) return { ok: false, error: 'Formato inválido' }
    const dek  = Buffer.from(hexStr, 'hex')
    const data = JSON.parse(_gcmDecrypt(enc.iv, enc.tag, enc.ciphertext, dek).toString('utf8'))
    _sessionDek = dek
    _deleteUndoFile(path.dirname(filePath)) // limpa undo.json em texto claro deixado por versões antigas
    return { ok: true, data }
  } catch { return { ok: false, error: 'Código de recuperação inválido' } }
})

ipcMain.handle('disable-encryption', async (_, password) => {
  if (!appConfig.dataPath) return { ok: false, error: 'Sem pasta de dados' }
  const filePath = path.join(appConfig.dataPath, 'ThriveData', 'data.json')
  try {
    const enc  = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!enc.encrypted) return { ok: false, error: 'Dados não estão encriptados' }
    const kek  = await _deriveKek(password, Buffer.from(enc.kek_salt, 'hex'))
    const dek  = _gcmDecrypt(enc.kek_iv, enc.kek_tag, enc.encrypted_dek, kek)
    const plain = _gcmDecrypt(enc.iv, enc.tag, enc.ciphertext, dek).toString('utf8')
    JSON.parse(plain)  // validate before overwriting
    atomicWriteFile(filePath, plain)
    // Devolve os backups a texto claro enquanto ainda temos a DEK;
    // os logs cifrados ficariam ilegíveis sem ela — recomeçam limpos.
    _decryptExistingBackups(path.dirname(filePath), dek)
    _deleteLogs(path.dirname(filePath))
    _sessionDek = null
    return { ok: true }
  } catch { return { ok: false, error: 'Password incorreta' } }
})

ipcMain.handle('change-password', async (_, oldPassword, newPassword) => {
  if (!appConfig.dataPath) return { ok: false, error: 'Sem pasta de dados' }
  const filePath = path.join(appConfig.dataPath, 'ThriveData', 'data.json')
  try {
    const enc    = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!enc.encrypted) return { ok: false, error: 'Dados não estão encriptados' }
    const oldKek = await _deriveKek(oldPassword, Buffer.from(enc.kek_salt, 'hex'))
    const dek    = _gcmDecrypt(enc.kek_iv, enc.kek_tag, enc.encrypted_dek, oldKek)
    const newSalt  = crypto.randomBytes(32)
    const newKek   = await _deriveKek(newPassword, newSalt)
    const newEncDek = _gcmEncrypt(dek, newKek)
    const updated = {
      ...enc,
      kek_salt: newSalt.toString('hex'),
      kek_iv: newEncDek.iv, kek_tag: newEncDek.tag, encrypted_dek: newEncDek.ciphertext,
    }
    atomicWriteFile(filePath, JSON.stringify(updated, null, 2))
    _sessionDek = dek
    return { ok: true }
  } catch { return { ok: false, error: 'Password antiga incorreta' } }
})

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      appConfig = { ...appConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
    }
  } catch (e) {
    console.log('Config not found, using defaults')
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    // Cor de fundo conforme o tema guardado — evita o flash escuro no
    // arranque quando o utilizador usa o tema claro.
    backgroundColor: appConfig.theme === 'light' ? '#f4f4f6' : '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
    icon: fs.existsSync(path.join(__dirname, '../build/icon.ico'))
      ? path.join(__dirname, '../build/icon.ico')
      : undefined,
  })

  // A app nunca abre janelas novas nem navega para fora do bundle local —
  // bloqueia ambos (defesa em profundidade contra links/redirects maliciosos).
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = isDev ? url.startsWith('http://localhost:5173') : url.startsWith('file://')
    if (!allowed) e.preventDefault()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Mostra a janela mesmo se ready-to-show não disparar
  setTimeout(() => { if (!mainWindow.isVisible()) mainWindow.show() }, 3000)

  if (isDev) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.openDevTools({ mode: 'bottom' })
    })
  }

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-change', { maximized: true })
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-change', { maximized: false })
  })
}

app.whenReady().then(() => {
  loadConfig()
  createWindow()
  // Verificação de updates 8s após o arranque (não bloqueia nada;
  // sem token ou em dev é um no-op silencioso)
  setTimeout(() => { try { _checkForUpdates() } catch { /* updater indisponível */ } }, 8000)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Window Controls ──────────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow.minimize())
ipcMain.handle('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize()
})
ipcMain.handle('window-close', () => mainWindow.close())
ipcMain.handle('window-is-maximized', () => mainWindow.isMaximized())

// ── Auto-update (GitHub Releases do repo privado) ────────────
// electron-updater com token fine-grained fornecido pelo utilizador
// nas Definições (appConfig.githubToken — Contents read/write, só o
// repo Thrive). Nada acontece sem token nem em dev. Download e
// instalação só a pedido explícito do utilizador.
let _updater = null
function _sendUpdateStatus(payload) {
  try { mainWindow?.webContents.send('update-status', payload) } catch { /* janela fechada */ }
}
function _getUpdater() {
  if (_updater) return _updater
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('update-available',     info => _sendUpdateStatus({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', ()   => _sendUpdateStatus({ state: 'none' }))
  autoUpdater.on('download-progress',    p    => _sendUpdateStatus({ state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded',    info => _sendUpdateStatus({ state: 'ready', version: info.version }))
  autoUpdater.on('error',                err  => _sendUpdateStatus({ state: 'error', message: String(err?.message || err) }))
  _updater = autoUpdater
  return _updater
}
function _checkForUpdates() {
  const token = appConfig.githubToken
  if (!token) return { ok: false, reason: 'no-token' }
  if (!app.isPackaged) return { ok: false, reason: 'dev' }
  const u = _getUpdater()
  u.setFeedURL({ provider: 'github', owner: 'MarioAfricano', repo: 'Thrive', private: true, token })
  _sendUpdateStatus({ state: 'checking' })
  u.checkForUpdates().catch(err => _sendUpdateStatus({ state: 'error', message: String(err?.message || err) }))
  return { ok: true }
}
ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('check-updates',   () => _checkForUpdates())
ipcMain.handle('download-update', () => {
  _updater?.downloadUpdate().catch(err => _sendUpdateStatus({ state: 'error', message: String(err?.message || err) }))
  return true
})
// (isSilent=true corre o NSIS com /S — sem assistente visível;
//  isForceRunAfter=true relança a app no fim)
ipcMain.handle('install-update', () => { _updater?.quitAndInstall(true, true); return true })

// ── Pasta Inbox (importação automática de extratos) ──────────
// <dataPath>/Inbox: o utilizador larga lá extratos .xlsx; o renderer
// lista-os ao arrancar, mostra a preview e, depois de importar, pede
// para os arquivar em Inbox/importados (nunca apaga nada).
// Nomes sempre reduzidos a path.basename — sem traversal.
function _inboxDir() {
  return appConfig.dataPath ? path.join(appConfig.dataPath, 'Inbox') : null
}

ipcMain.handle('list-inbox', () => {
  const dir = _inboxDir()
  if (!dir) return []
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.xlsx'))
      .map(f => {
        const st = fs.statSync(path.join(dir, f))
        return { name: f, size: st.size, mtime: st.mtimeMs }
      })
      .sort((a, b) => a.mtime - b.mtime)
  } catch { return [] }
})

ipcMain.handle('read-inbox-file', (_, name) => {
  const dir = _inboxDir()
  if (!dir || typeof name !== 'string') return null
  const safe = path.basename(name)
  if (!safe.toLowerCase().endsWith('.xlsx')) return null
  try { return fs.readFileSync(path.join(dir, safe)).toString('base64') } catch { return null }
})

ipcMain.handle('archive-inbox-file', (_, name) => {
  const dir = _inboxDir()
  if (!dir || typeof name !== 'string') return false
  const safe = path.basename(name)
  try {
    const arcDir = path.join(dir, 'importados')
    if (!fs.existsSync(arcDir)) fs.mkdirSync(arcDir, { recursive: true })
    let dest = path.join(arcDir, safe)
    if (fs.existsSync(dest)) dest = path.join(arcDir, `${Date.now()}-${safe}`)
    fs.renameSync(path.join(dir, safe), dest)
    return true
  } catch { return false }
})

ipcMain.handle('open-inbox-folder', () => {
  const dir = _inboxDir()
  if (!dir) return false
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    shell.openPath(dir)
    return true
  } catch { return false }
})

// ── Notificações nativas ─────────────────────────────────────
// Toast do Windows com os próximos eventos (o renderer calcula e
// limita a frequência). Só strings curtas — nada de dados sensíveis
// além do que o utilizador veria no Dashboard.
ipcMain.handle('show-notification', (_, { title, body } = {}) => {
  if (typeof title !== 'string' || typeof body !== 'string') return false
  if (!Notification.isSupported()) return false
  new Notification({
    title: title.slice(0, 120),
    body:  body.slice(0, 500),
    silent: true,
  }).show()
  return true
})

// ── Config ───────────────────────────────────────────────────
ipcMain.handle('get-config', () => appConfig)

ipcMain.handle('save-config', (_, newConfig) => {
  appConfig = { ...appConfig, ...newConfig }
  saveConfig()
  return appConfig
})

// Estado da API key (sem nunca expor o valor ao renderer)
ipcMain.handle('api-key-status', () => ({
  alphaVantage: { present: hasAvKey(), source: process.env.ALPHA_VANTAGE_KEY ? 'env' : (appConfig.alphaVantageKey ? 'config' : null) },
}))

// Permite guardar a key a partir de uma UI futura em Settings
ipcMain.handle('set-alpha-vantage-key', (_, key) => {
  appConfig = { ...appConfig, alphaVantageKey: (key || '').trim() || null }
  saveConfig()
  _avKeyWarned = false
  return { ok: true, present: hasAvKey() }
})

// ── Folder Selection ─────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecionar pasta para guardar dados do Thrive',
    buttonLabel: 'Selecionar',
  })
  if (!result.canceled && result.filePaths[0]) {
    return result.filePaths[0]
  }
  return null
})

// ── Event log (JSONL) ────────────────────────────────────────
// Auditoria local: uma linha por save financeiro.
const EVENT_LOG_MAX_BYTES = 2 * 1024 * 1024 // 2 MB → truncate para metade
function appendEvent(dirPath, event) {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    const logPath = path.join(dirPath, 'events.log')
    const line = _encodeLogLine({ timestamp: new Date().toISOString(), ...event }) + '\n'
    fs.appendFileSync(logPath, line)
    // Rotação simples: se passar do limite, fica com a última metade
    const st = fs.statSync(logPath)
    if (st.size > EVENT_LOG_MAX_BYTES) {
      const raw = fs.readFileSync(logPath, 'utf8')
      const half = Math.floor(raw.length / 2)
      const trimmed = raw.slice(raw.indexOf('\n', half) + 1)
      atomicWriteFile(logPath, trimmed)
    }
  } catch (e) {
    console.warn('[Thrive] Falhou event log:', e.message)
  }
}

ipcMain.handle('read-events', (_, limit = 200) => {
  if (!appConfig.dataPath) return []
  const logPath = path.join(appConfig.dataPath, 'ThriveData', 'events.log')
  if (!fs.existsSync(logPath)) return []
  try {
    const raw = fs.readFileSync(logPath, 'utf8').trim()
    if (!raw) return []
    const lines = raw.split(/\r?\n/).slice(-limit)
    const out = []
    for (const l of lines) {
      const payload = _decodeLogLine(l)
      if (payload) out.push(payload)
    }
    return out
  } catch (e) {
    console.warn('[Thrive] Falhou read-events:', e.message)
    return []
  }
})

// ── Data Read/Write ──────────────────────────────────────────
// Escrita atómica: write(tmp) → fsync → rename(tmp → final).
// Garante que um crash a meio nunca deixa o ficheiro truncado.
function atomicWriteFile(filePath, contents) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  const fd = fs.openSync(tmpPath, 'w')
  try {
    fs.writeSync(fd, contents)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(tmpPath, filePath)
}

// Mantém snapshot diário por ficheiro em <dataPath>/ThriveData/backups/,
// e roda-os mantendo os últimos N.
const BACKUP_MAX = 30
function writeDailyBackup(dirPath, filename, contents) {
  try {
    const backupsDir = path.join(dirPath, 'backups')
    fs.mkdirSync(backupsDir, { recursive: true })
    const base  = filename.replace(/\.json$/, '')
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const backupPath = path.join(backupsDir, `${base}-${today}.json`)
    atomicWriteFile(backupPath, contents)
    // Rotação: manter só os N mais recentes para este `base`
    const entries = fs.readdirSync(backupsDir)
      .filter(n => n.startsWith(`${base}-`) && n.endsWith('.json'))
      .map(n => ({ name: n, full: path.join(backupsDir, n) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    while (entries.length > BACKUP_MAX) {
      const oldest = entries.shift()
      try { fs.unlinkSync(oldest.full) } catch {}
    }
  } catch (e) {
    console.warn('[Thrive] Falhou backup diário:', e.message)
  }
}

// Tenta ler e fazer parse. Se falhar e houver backups, devolve o mais recente.
function readWithBackupFallback(dirPath, filename) {
  const filePath = path.join(dirPath, filename)
  if (fs.existsSync(filePath)) {
    try {
      return { data: JSON.parse(fs.readFileSync(filePath, 'utf8')), source: 'primary' }
    } catch (e) {
      console.error(`[Thrive] ${filename} ilegível — a tentar backup. Erro:`, e.message)
    }
  }
  // Fallback para o backup mais recente
  try {
    const backupsDir = path.join(dirPath, 'backups')
    if (!fs.existsSync(backupsDir)) return { data: null, source: 'none' }
    const base = filename.replace(/\.json$/, '')
    const candidates = fs.readdirSync(backupsDir)
      .filter(n => n.startsWith(`${base}-`) && n.endsWith('.json'))
      .sort()
      .reverse()
    for (const c of candidates) {
      try {
        const raw = fs.readFileSync(path.join(backupsDir, c), 'utf8')
        const parsed = JSON.parse(raw)
        console.warn(`[Thrive] Recuperado de backup: ${c}`)
        return { data: parsed, source: c }
      } catch {}
    }
  } catch {}
  return { data: null, source: 'none' }
}

// Whitelist dos ficheiros que o renderer pode ler/escrever via IPC.
// Nunca aceitar caminhos arbitrários — evita traversal para fora de ThriveData.
const DATA_FILES = new Set(['data.json', 'undo.json', 'inflation.json'])
const isSafeDataFile = (name) => DATA_FILES.has(name)
// Nomes de backup: gerados por writeDailyBackup — `<base>-YYYY-MM-DD.json`
const isSafeBackupName = (name) =>
  typeof name === 'string' && /^[\w.-]+\.json$/.test(name) && !name.includes('..')

ipcMain.handle('read-data', (_, filename) => {
  if (!appConfig.dataPath || !isSafeDataFile(filename)) return null
  const dirPath = path.join(appConfig.dataPath, 'ThriveData')
  const { data } = readWithBackupFallback(dirPath, filename)
  return data
})

ipcMain.handle('write-data', (_, filename, data, meta) => {
  if (!appConfig.dataPath || !isSafeDataFile(filename)) return false
  const dirPath  = path.join(appConfig.dataPath, 'ThriveData')
  const filePath = path.join(dirPath, filename)
  let contents
  if (filename === 'data.json' && _sessionDek) {
    try {
      const rawFile = fs.readFileSync(filePath, 'utf8')
      const existing = JSON.parse(rawFile)
      contents = _buildEncryptedPayload(existing, data, _sessionDek)
    } catch (e) {
      console.error('[Thrive] Falhou re-encriptação:', e.message)
      return false
    }
  } else {
    // Sessão bloqueada (sem DEK): nunca sobrepor um data.json encriptado
    // com JSON em claro — recusa em vez de corromper o modo de encriptação.
    if (filename === 'data.json' && !_sessionDek) {
      try {
        const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        if (existing.encrypted === true) {
          console.error('[Thrive] write-data recusado: sessão bloqueada sobre ficheiro encriptado')
          return false
        }
      } catch {} // ficheiro inexistente/ilegível → segue escrita normal
    }
    contents = JSON.stringify(data, null, 2)
  }
  try {
    atomicWriteFile(filePath, contents)
    if (filename === 'data.json') writeDailyBackup(dirPath, filename, contents)
    if (meta && meta.label && filename === 'data.json') {
      appendEvent(dirPath, { label: meta.label })
    }
    return true
  } catch (e) {
    console.error('Failed to write data:', e)
    return false
  }
})

ipcMain.handle('data-exists', (_, filename) => {
  if (!appConfig.dataPath || !isSafeDataFile(filename)) return false
  const filePath = path.join(appConfig.dataPath, 'ThriveData', filename)
  return fs.existsSync(filePath)
})

// Lê o backup mais recente (sem fallback para o ficheiro principal).
ipcMain.handle('list-backups', (_, filename) => {
  if (!appConfig.dataPath) return []
  const backupsDir = path.join(appConfig.dataPath, 'ThriveData', 'backups')
  if (!fs.existsSync(backupsDir)) return []
  const base = (filename || 'data').replace(/\.json$/, '')
  try {
    return fs.readdirSync(backupsDir)
      .filter(n => n.startsWith(`${base}-`) && n.endsWith('.json'))
      .sort()
      .reverse()
  } catch { return [] }
})

ipcMain.handle('restore-backup', (_, backupName, targetFilename) => {
  if (!appConfig.dataPath) return false
  if (!isSafeBackupName(backupName)) return false
  if (targetFilename && !isSafeDataFile(targetFilename)) return false
  const dirPath    = path.join(appConfig.dataPath, 'ThriveData')
  const backupPath = path.join(dirPath, 'backups', backupName)
  const targetPath = path.join(dirPath, targetFilename || 'data.json')
  try {
    const raw = fs.readFileSync(backupPath, 'utf8')
    const backupIsEncrypted = JSON.parse(raw).encrypted === true // valida antes de sobrepor
    if (_sessionDek) {
      // Encriptação ativa: nunca deixar cair um ficheiro em texto claro no
      // lugar do data.json encriptado — o write-data seguinte iria construir
      // um payload sem campos KEK e a password deixava de funcionar.
      if (backupIsEncrypted) {
        atomicWriteFile(targetPath, raw)
      } else {
        const current = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
        if (current.encrypted !== true) return false
        atomicWriteFile(targetPath, _buildEncryptedPayload(current, raw, _sessionDek))
      }
    } else {
      // Sessão sem encriptação: restaurar um backup encriptado deixaria o
      // ficheiro num estado que o próximo save (em texto claro) destruiria.
      if (backupIsEncrypted) {
        console.error('Failed to restore backup: backup encriptado numa sessão sem encriptação')
        return false
      }
      atomicWriteFile(targetPath, raw)
    }
    return true
  } catch (e) {
    console.error('Failed to restore backup:', e)
    return false
  }
})

// ── Export / Import dialogs ──────────────────────────────────
ipcMain.handle('show-save-dialog', async (_, { defaultPath, content, filters, encoding }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  if (result.canceled || !result.filePath) return { ok: false }
  try {
    // encoding 'base64' → conteúdo binário (ex.: .xlsx); default texto utf8
    if (encoding === 'base64') fs.writeFileSync(result.filePath, Buffer.from(content, 'base64'))
    else fs.writeFileSync(result.filePath, content, 'utf8')
    return { ok: true, filePath: result.filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('show-open-dialog', async (_, { filters, encoding }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  if (result.canceled || !result.filePaths[0]) return { ok: false }
  try {
    // encoding 'base64' → ficheiros binários (ex.: .xlsx); default texto utf8
    const content = encoding === 'base64'
      ? fs.readFileSync(result.filePaths[0]).toString('base64')
      : fs.readFileSync(result.filePaths[0], 'utf8')
    return { ok: true, content, filePath: result.filePaths[0] }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ── Alpha Vantage Stock Fetch ─────────────────────────────────
const https = require('https')

// ── HICP Portugal (Eurostat) ──────────────────────────────────
// Taxa de variação homóloga média anual — Category CP00 (todos os bens).
// Cache 24 h (os dados mudam uma vez por mês no máximo).
const _inflCache = { data: null, ts: 0 }
const INFL_TTL   = 24 * 60 * 60 * 1000

ipcMain.handle('fetch-inflation', async () => {
  if (_inflCache.data && Date.now() - _inflCache.ts < INFL_TTL) return _inflCache.data
  const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_aind?geo=PT&unit=RCH_A_AVG&coicop=CP00&format=JSON'
  const json = await httpsGetJson(url, { timeout: 12000 })
  if (!json?.dimension?.time?.category?.index) return null
  const indexMap = json.dimension.time.category.index
  const values   = json.value || []
  const rates    = {}
  for (const [yearStr, idx] of Object.entries(indexMap)) {
    const v = values[idx]
    if (v != null) rates[Number(yearStr)] = v / 100
  }
  if (!Object.keys(rates).length) return null
  _inflCache.data = rates
  _inflCache.ts   = Date.now()
  return rates
})

// A chave é lida em runtime: prioridade env > appConfig. Never hardcoded.
function getAvKey() {
  return (process.env.ALPHA_VANTAGE_KEY || appConfig.alphaVantageKey || '').trim()
}
function hasAvKey() { return !!getAvKey() }
let _avKeyWarned = false
function warnNoAvKey() {
  if (_avKeyWarned) return
  _avKeyWarned = true
  console.warn('[Thrive] Alpha Vantage key não configurada — fetch de preços de ações desativado. Define ALPHA_VANTAGE_KEY ou grava alphaVantageKey em thrive-config.json.')
}

// Rate limiter: tier gratuito = 5 pedidos/minuto
const _avCallTimes = []
function _avWait() {
  return new Promise(resolve => {
    const now = Date.now()
    // Remove chamadas com mais de 60 segundos
    while (_avCallTimes.length && now - _avCallTimes[0] > 60000) _avCallTimes.shift()
    if (_avCallTimes.length < 5) {
      _avCallTimes.push(Date.now()); resolve()
    } else {
      const wait = 60000 - (now - _avCallTimes[0]) + 200
      setTimeout(() => { _avCallTimes.shift(); _avCallTimes.push(Date.now()); resolve() }, wait)
    }
  })
}

// Cache em memória (5 min TTL) para não desperdiçar pedidos
const _priceCache = new Map()
const _histCache  = new Map()
const CACHE_TTL   = 5 * 60 * 1000

async function avGet(params) {
  const key = getAvKey()
  if (!key) { warnNoAvKey(); return null }
  await _avWait()
  const qs  = new URLSearchParams({ ...params, apikey: key }).toString()
  const url = `https://www.alphavantage.co/query?${qs}`
  const json = await new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(null) } })
    }).on('error', () => resolve(null))
  })
  // Quota excedida (tier gratuito: ~25 pedidos/dia) ou throttle: a AV responde
  // 200 com um corpo `Note`/`Information` sem dados — não confundir com sucesso.
  if (json && (json.Note || json.Information)) {
    console.warn('[Thrive] Alpha Vantage rate limit:', json.Note || json.Information)
    _notifyAvRateLimit()
    return null
  }
  return json
}

// Avisa o renderer (toast) quando a quota da AV esgota — no máximo 1×/10 min.
let _avRateLimitNotifiedAt = 0
function _notifyAvRateLimit() {
  const now = Date.now()
  if (now - _avRateLimitNotifiedAt < 10 * 60 * 1000) return
  if (!mainWindow || mainWindow.isDestroyed()) return
  _avRateLimitNotifiedAt = now
  mainWindow.webContents.send('av-rate-limit')
}

// Normalizar ticker para o formato Alpha Vantage
// (remove .US, converte sufixos Yahoo Finance → AV)
const SUFFIX_MAP = {
  // Yahoo → Alpha Vantage
  'US':  null,   // NKE.US  → NKE  (AV não usa sufixo para EUA)
  'LS':  'LIS',  // EDP.LS  → EDP.LIS  (Lisboa)
  'L':   'LON',  // VOD.L   → VOD.LON  (Londres)
  'DE':  'DEX',  // ADS.DE  → ADS.DEX  (Frankfurt/Xetra)
  'PA':  'EPA',  // MC.PA   → MC.EPA   (Paris)
  'AS':  'AMS',  // ASML.AS → ASML.AMS (Amesterdão)
  'MC':  'MAD',  // ITX.MC  → ITX.MAD  (Madrid)
  'MI':  'MIL',  // ENEL.MI → ENEL.MIL (Milão)
  'TO':  'TRT',  // SHOP.TO → SHOP.TRT (Toronto)
  'AX':  'AUS',  // CBA.AX  → CBA.AUS  (Austrália)
  'T':   'TYO',  // 7203.T  → 7203.TYO (Tóquio)
  'HK':  'HKG',  // 0700.HK → 0700.HKG (Hong Kong)
  'SA':  'SAO',  // PETR4.SA→ PETR4.SAO (São Paulo)
  'V':   'VAN',  // ticker.V → ticker.VAN (Vancouver)
  'BR':  'BRU',  // AB.BR   → AB.BRU   (Bruxelas)
  'CO':  'CPH',  // NVO.CO  → NVO.CPH  (Copenhaga)
  'ST':  'STO',  // VOLV.ST → VOLV.STO (Estocolmo)
  'OL':  'OSL',  // DNB.OL  → DNB.OSL  (Oslo)
  'HE':  'HEL',  // NOKIA.HE→ NOKIA.HEL(Helsínquia)
}

function normalizeTicker(raw) {
  const parts  = (raw || '').trim().toUpperCase().split('.')
  if (parts.length < 2) return raw.trim().toUpperCase() // sem sufixo → AV nativo
  const base   = parts.slice(0, -1).join('.')
  const suffix = parts[parts.length - 1]
  const mapped = SUFFIX_MAP[suffix]
  if (mapped === null)   return base          // remove sufixo (ex: .US)
  if (mapped)            return `${base}.${mapped}` // converte sufixo
  return raw.trim().toUpperCase()             // sufixo desconhecido → mantém
}

// Inferir moeda pelo sufixo ORIGINAL (antes de normalizar)
function inferCurrency(ticker) {
  const t = (ticker || '').toUpperCase()
  if (/\.(LS|PA|DE|AS|MC|MI|BR|VX|ST|CO|HE|OL|LIS|DEX|EPA|AMS|MAD|MIL|BRU|CPH|STO|OSL|HEL)$/.test(t)) return 'EUR'
  if (/\.(L|LON)$/.test(t))      return 'GBP'
  if (/\.(T|TYO)$/.test(t))      return 'JPY'
  if (/\.(HK|HKG)$/.test(t))     return 'HKD'
  if (/\.(TO|TRT|V|VAN)$/.test(t)) return 'CAD'
  if (/\.(AX|AUS)$/.test(t))     return 'AUD'
  if (/\.(SA|SAO)$/.test(t))     return 'BRL'
  return 'USD'
}

ipcMain.handle('fetch-stock-price', async (_, ticker) => {
  const symbol = normalizeTicker(ticker)
  const cacheKey = symbol
  const cached = _priceCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const json = await avGet({ function: 'GLOBAL_QUOTE', symbol })
  const q    = json?.['Global Quote']
  if (!q?.['05. price']) return null

  const result = {
    price:         parseFloat(q['05. price']),
    currency:      inferCurrency(ticker),  // moeda inferida do ticker original
    previousClose: parseFloat(q['08. previous close']) || null,
  }
  _priceCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
})

ipcMain.handle('fetch-stock-history', async (_, ticker) => {
  const symbol   = normalizeTicker(ticker)
  const cacheKey = symbol
  const cached   = _histCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const json   = await avGet({ function: 'TIME_SERIES_MONTHLY', symbol })
  const series = json?.['Monthly Time Series']
  if (!series) return null

  // Datas no formato "YYYY-MM-DD" (último dia de trading do mês)
  const points = Object.entries(series)
    .map(([d, v]) => {
      const [y, m] = d.split('-').map(Number)
      return { year: y, month: m - 1, price: parseFloat(v['4. close']) } // month 0-indexed
    })
    .filter(p => !isNaN(p.price))
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)

  const result = { currency: inferCurrency(ticker), points }
  _histCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
})

// ── Fetch JSON genérico via https (evita CORS no renderer) ──
// Em dev (Vite em http://localhost:5173) o renderer é sujeito a CORS;
// no build empacotado (file://) normalmente não. Para ter o mesmo
// comportamento nos dois, todas as chamadas a APIs públicas passam por aqui.
//
// Suporta timeout por tentativa e retry automático (backoff simples).
function httpsGetJson(url, { retries = 1, timeout = 10000 } = {}) {
  return new Promise(resolve => {
    const attempt = (n) => {
      const req = https.get(
        url,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Thrive-Finance)' }, timeout },
        res => {
          // Um 429/500 pode trazer um corpo JSON válido (ex.: erro do CoinGecko)
          // que os chamadores iriam cachear como resposta boa — trata como falha.
          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume() // liberta o socket
            console.warn(`[Thrive] httpsGetJson HTTP ${res.statusCode}: ${url}`)
            if (n < retries) setTimeout(() => attempt(n + 1), 500 * (n + 1))
            else resolve(null)
            return
          }
          let raw = ''
          res.on('data', c => raw += c)
          res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(null) } })
        }
      )
      req.on('timeout', () => {
        req.destroy()
        if (n < retries) {
          setTimeout(() => attempt(n + 1), 500 * (n + 1))
        } else {
          console.warn(`[Thrive] httpsGetJson timeout: ${url}`)
          resolve(null)
        }
      })
      req.on('error', err => {
        if (n < retries) {
          setTimeout(() => attempt(n + 1), 500 * (n + 1))
        } else {
          console.warn(`[Thrive] httpsGetJson error: ${err.message} — ${url}`)
          resolve(null)
        }
      })
    }
    attempt(0)
  })
}

// ── Taxas de câmbio (Frankfurter) ──────────────────────────────
// Cache 10 minutos — as taxas oficiais só mudam uma vez por dia.
const _fxCache = { data: null, ts: 0 }
const FX_TTL = 10 * 60 * 1000

ipcMain.handle('fetch-exchange-rates', async () => {
  if (_fxCache.data && Date.now() - _fxCache.ts < FX_TTL) return _fxCache.data
  const json = await httpsGetJson('https://api.frankfurter.dev/v1/latest?from=EUR')
  if (!json?.rates) return null
  _fxCache.data = json
  _fxCache.ts   = Date.now()
  return json
})

// ── Preços de crypto (CoinGecko) ───────────────────────────────
// Cache 1 minuto — CoinGecko público tem rate limit generoso mas não infinito.
const _coinCache = new Map()
const COIN_TTL = 60 * 1000

ipcMain.handle('fetch-crypto-prices', async (_, ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return {}
  const key    = ids.slice().sort().join(',')
  const cached = _coinCache.get(key)
  if (cached && Date.now() - cached.ts < COIN_TTL) return cached.data
  const url  = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(key)}&vs_currencies=eur`
  const json = await httpsGetJson(url)
  if (!json || typeof json !== 'object') return {}
  _coinCache.set(key, { data: json, ts: Date.now() })
  return json
})

// ── Error log (JSONL) ────────────────────────────────────────
// Complementa o event log: guarda erros capturados por `ErrorBoundary`
// do renderer em <dataPath>/ThriveData/errors.log. Rotação simples a 2MB.
const ERROR_LOG_MAX_BYTES = 2 * 1024 * 1024
function appendError(dirPath, payload) {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    const logPath = path.join(dirPath, 'errors.log')
    const line = _encodeLogLine({ timestamp: new Date().toISOString(), ...payload }) + '\n'
    fs.appendFileSync(logPath, line)
    const st = fs.statSync(logPath)
    if (st.size > ERROR_LOG_MAX_BYTES) {
      const raw = fs.readFileSync(logPath, 'utf8')
      const half = Math.floor(raw.length / 2)
      const trimmed = raw.slice(raw.indexOf('\n', half) + 1)
      atomicWriteFile(logPath, trimmed)
    }
  } catch (e) {
    console.warn('[Thrive] Falhou error log:', e.message)
  }
}

ipcMain.handle('log-error', (_, payload) => {
  if (!appConfig.dataPath) return false
  const dir = path.join(appConfig.dataPath, 'ThriveData')
  appendError(dir, payload || {})
  return true
})

ipcMain.handle('read-errors', (_, limit = 200) => {
  if (!appConfig.dataPath) return []
  const logPath = path.join(appConfig.dataPath, 'ThriveData', 'errors.log')
  if (!fs.existsSync(logPath)) return []
  try {
    const raw = fs.readFileSync(logPath, 'utf8').trim()
    if (!raw) return []
    const lines = raw.split(/\r?\n/).slice(-limit)
    const out = []
    for (const l of lines) {
      const payload = _decodeLogLine(l)
      if (payload) out.push(payload)
    }
    return out
  } catch (e) {
    console.warn('[Thrive] Falhou read-errors:', e.message)
    return []
  }
})
