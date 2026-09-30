// Testes de integração dos handlers IPC de encriptação do main.cjs.
// O módulo 'electron' é substituído por stubs via Module._load, e os handlers
// registados em ipcMain.handle são invocados diretamente contra uma pasta
// de dados temporária. Os testes correm por ordem e partilham estado — cada
// bloco continua o cenário do anterior (ativar → unlock → save → restauro →
// desativar), como numa sessão real.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Module, { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const require = createRequire(import.meta.url)

let TMP, DATA_DIR
const handlers = {}
const sample = { currentYear: 2026, currentMonth: 5, banks: { platforms: [] } }

const read  = f => fs.readFileSync(path.join(DATA_DIR, f), 'utf8')
const isEnc = f => { try { return JSON.parse(read(f)).encrypted === true } catch { return false } }

beforeAll(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'thrive-enc-test-'))
  DATA_DIR = path.join(TMP, 'ThriveData')

  const origLoad = Module._load
  Module._load = function (request, ...rest) {
    if (request === 'electron') {
      return {
        app: {
          isPackaged: true,
          getPath: () => TMP,
          whenReady: () => new Promise(() => {}), // nunca resolve — não abre janela
          on: () => {},
        },
        BrowserWindow: function () {},
        ipcMain: { handle: (name, fn) => { handlers[name] = fn } },
        dialog: {},
      }
    }
    return origLoad.call(this, request, ...rest)
  }
  require('../main.cjs')
  Module._load = origLoad

  await handlers['save-config'](null, { dataPath: TMP })
  fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, 'data.json'), JSON.stringify(sample, null, 2))
  fs.writeFileSync(path.join(DATA_DIR, 'backups', 'data-2026-06-01.json'), JSON.stringify(sample))
  fs.writeFileSync(path.join(DATA_DIR, 'backups', 'data-2026-06-02.json'), JSON.stringify(sample))
  fs.writeFileSync(path.join(DATA_DIR, 'undo.json'), JSON.stringify([{ id: 1, data: sample }]))
})

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

let recoveryCode

describe('enable-encryption', () => {
  it('encripta data.json e devolve código de recuperação', async () => {
    const res = await handlers['enable-encryption'](null, 'password123')
    expect(res.ok).toBe(true)
    expect(res.recoveryCode).toMatch(/^[0-9A-F]{8}( [0-9A-F]{8}){7}$/)
    recoveryCode = res.recoveryCode
    expect(isEnc('data.json')).toBe(true)
  })

  it('encripta os backups diários pré-existentes com a mesma DEK', () => {
    expect(isEnc('backups/data-2026-06-01.json')).toBe(true)
    expect(isEnc('backups/data-2026-06-02.json')).toBe(true)
  })

  it('apaga o undo.json em texto claro', () => {
    expect(fs.existsSync(path.join(DATA_DIR, 'undo.json'))).toBe(false)
  })
})

describe('unlock', () => {
  it('rejeita password errada', async () => {
    const res = await handlers['unlock-data'](null, 'errada')
    expect(res.ok).toBe(false)
  })

  it('devolve os dados com a password certa e limpa undo.json residual', async () => {
    fs.writeFileSync(path.join(DATA_DIR, 'undo.json'), '[]') // resto de versão antiga
    const res = await handlers['unlock-data'](null, 'password123')
    expect(res.ok).toBe(true)
    expect(res.data.currentYear).toBe(2026)
    expect(fs.existsSync(path.join(DATA_DIR, 'undo.json'))).toBe(false)
  })

  it('aceita o código de recuperação', async () => {
    const res = await handlers['unlock-with-recovery'](null, recoveryCode)
    expect(res.ok).toBe(true)
    expect(res.data.currentYear).toBe(2026)
  })
})

describe('write-data com sessão encriptada', () => {
  it('re-encripta o data.json e os dados sobrevivem ao ciclo', async () => {
    const ok = await handlers['write-data'](null, 'data.json', { ...sample, currentMonth: 6 }, { label: 'teste' })
    expect(ok).toBe(true)
    expect(isEnc('data.json')).toBe(true)
    const res = await handlers['unlock-data'](null, 'password123')
    expect(res.ok).toBe(true)
    expect(res.data.currentMonth).toBe(6)
  })

  it('recusa filenames fora da whitelist', async () => {
    expect(await handlers['write-data'](null, '../fora.json', {})).toBe(false)
    expect(await handlers['read-data'](null, '..\\..\\config')).toBe(null)
    expect(await handlers['data-exists'](null, '../data.json')).toBe(false)
  })
})

describe('restore-backup', () => {
  it('restaura backup encriptado e a password continua a funcionar', async () => {
    const ok = await handlers['restore-backup'](null, 'data-2026-06-01.json', 'data.json')
    expect(ok).toBe(true)
    expect(isEnc('data.json')).toBe(true)
    const res = await handlers['unlock-data'](null, 'password123')
    expect(res.ok).toBe(true)
    expect(res.data.currentMonth).toBe(5)
  })

  it('re-encripta um backup em texto claro antes de o restaurar', async () => {
    fs.writeFileSync(path.join(DATA_DIR, 'backups', 'data-2026-06-03.json'), JSON.stringify({ ...sample, currentMonth: 9 }))
    const ok = await handlers['restore-backup'](null, 'data-2026-06-03.json', 'data.json')
    expect(ok).toBe(true)
    expect(isEnc('data.json')).toBe(true)
    const res = await handlers['unlock-data'](null, 'password123')
    expect(res.ok).toBe(true)
    expect(res.data.currentMonth).toBe(9)
  })

  it('recusa nomes de backup com traversal', async () => {
    expect(await handlers['restore-backup'](null, '../data.json', 'data.json')).toBe(false)
    expect(await handlers['restore-backup'](null, 'a/../../x.json', 'data.json')).toBe(false)
  })
})

describe('get-recovery-code / lock-session', () => {
  it('devolve o código original mediante a password certa', async () => {
    const res = await handlers['get-recovery-code'](null, 'password123')
    expect(res.ok).toBe(true)
    expect(res.code).toBe(recoveryCode)
  })

  it('rejeita password errada', async () => {
    const res = await handlers['get-recovery-code'](null, 'errada')
    expect(res.ok).toBe(false)
  })

  it('lock-session descarta a DEK: write-data em claro é recusado sobre ficheiro encriptado', async () => {
    await handlers['lock-session']()
    const ok = await handlers['write-data'](null, 'data.json', { currentYear: 1999, currentMonth: 0 })
    expect(ok).toBe(false)
    expect(isEnc('data.json')).toBe(true) // ficheiro intacto
    // Desbloquear repõe a sessão
    const un = await handlers['unlock-data'](null, 'password123')
    expect(un.ok).toBe(true)
  })
})

describe('logs encriptados', () => {
  it('com sessão encriptada, as linhas do events.log ficam cifradas mas legíveis via IPC', async () => {
    // currentMonth 9 preserva o estado que o teste de disable-encryption espera
    await handlers['write-data'](null, 'data.json', { ...sample, currentMonth: 9 }, { label: 'SegredoTeste' })
    const raw = read('events.log')
    expect(raw).not.toContain('SegredoTeste')          // cifrado no disco
    const events = await handlers['read-events'](null, 10)
    expect(events.some(e => e.label === 'SegredoTeste')).toBe(true) // legível com DEK
  })

  it('sem DEK (sessão bloqueada), as linhas cifradas são omitidas', async () => {
    await handlers['lock-session']()
    const events = await handlers['read-events'](null, 10)
    expect(events.some(e => e.label === 'SegredoTeste')).toBe(false)
    await handlers['unlock-data'](null, 'password123')
  })
})

describe('disable-encryption', () => {
  it('devolve data.json e os backups a texto claro', async () => {
    const res = await handlers['disable-encryption'](null, 'password123')
    expect(res.ok).toBe(true)
    expect(isEnc('data.json')).toBe(false)
    expect(JSON.parse(read('data.json')).currentMonth).toBe(9)
    expect(isEnc('backups/data-2026-06-01.json')).toBe(false)
    expect(isEnc('backups/data-2026-06-02.json')).toBe(false)
    expect(isEnc('backups/data-2026-06-03.json')).toBe(false)
  })

  it('sessão sem encriptação recusa restaurar backup encriptado', async () => {
    // cria um backup encriptado depois do sweep de desencriptação
    await handlers['enable-encryption'](null, 'outra-pass')
    const encContent = read('data.json')
    await handlers['disable-encryption'](null, 'outra-pass')
    fs.writeFileSync(path.join(DATA_DIR, 'backups', 'data-2026-06-04.json'), encContent)
    const ok = await handlers['restore-backup'](null, 'data-2026-06-04.json', 'data.json')
    expect(ok).toBe(false)
    expect(isEnc('data.json')).toBe(false)
  })
})
