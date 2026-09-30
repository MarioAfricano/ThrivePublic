import { useState, useRef, useEffect } from 'react'
import { Download, Upload, FileJson, FileText, Table, AlertTriangle, CheckCircle, X, Archive, Sun, Moon, RotateCcw, FolderInput } from 'lucide-react'
import { getStoredTheme, setTheme } from '../utils/theme.js'
import CategoryColors from '../components/settings/CategoryColors.jsx'
import { useApp } from '../context/AppContext.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import { exportHoldingsCSV, exportAnnualSummaryCSV, exportFullJSON, triggerDownload } from '../utils/exportData.js'
import { buildAnnualReportHTML } from '../utils/annualReport.js'
import { applyMigrations } from '../data/migrations.js'
import { validateData } from '../schemas/index.js'
import { parseXtb } from '../utils/importXtb.js'
import XtbImportModal from '../components/settings/XtbImportModal.jsx'
import UpdatesSection from '../components/settings/UpdatesSection.jsx'
import { toastBus } from '../utils/toastBus.js'

const isElectron = typeof window !== 'undefined' && !!window.api

function today() { return new Date().toISOString().slice(0, 10) }

async function saveFile({ filename, content, mimeType, filters }) {
  if (isElectron) {
    return window.api.showSaveDialog({ defaultPath: filename, content, filters })
  }
  triggerDownload(content, filename, mimeType)
  return { ok: true }
}

// ── Confirm Import Modal ────────────────────────────────────────
function ConfirmImportModal({ importedData, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    await onConfirm(importedData)
    setLoading(false)
    onClose()
  }

  const year  = importedData?.currentYear  ?? '—'
  const month = importedData?.currentMonth ?? '—'
  const nBanks = importedData?.banks?.platforms?.length ?? 0
  const nStocks = (importedData?.stocks?.acoes?.holdings?.length ?? 0) + (importedData?.stocks?.etfs?.holdings?.length ?? 0)
  const nCrypto = (importedData?.crypto?.platforms ?? []).reduce((s, p) => s + (p.holdings?.length ?? 0), 0)
  const nDebts  = importedData?.debts?.length ?? 0

  return (
    <Modal title="Confirmar importação" onClose={onClose} maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10 }}>
          <AlertTriangle size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
            Os dados atuais serão <strong>substituídos</strong> permanentemente. Esta ação não pode ser desfeita.
          </p>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Dados a importar</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Mês actual:</span>
            <span>{year}/{String(Number(month) + 1).padStart(2, '0')}</span>
            <span style={{ color: 'var(--text-muted)' }}>Plataformas bancárias:</span>
            <span>{nBanks}</span>
            <span style={{ color: 'var(--text-muted)' }}>Posições (Ações/ETFs):</span>
            <span>{nStocks}</span>
            <span style={{ color: 'var(--text-muted)' }}>Holdings cripto:</span>
            <span>{nCrypto}</span>
            <span style={{ color: 'var(--text-muted)' }}>Dívidas:</span>
            <span>{nDebts}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
          <Button onClick={confirm} loading={loading} style={{ flex: 1, background: '#ef4444' }}>
            Substituir dados
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── ExportCard ──────────────────────────────────────────────────
function ExportCard({ icon: Icon, title, description, onExport, loading }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} color="var(--accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      </div>
      <Button size="sm" variant="ghost" loading={loading} onClick={onExport}>
        <Download size={13} style={{ marginRight: 5 }} />
        Exportar
      </Button>
    </div>
  )
}

// ── Settings page ───────────────────────────────────────────────
export default function Settings() {
  const { data, importData, saveData } = useApp()

  const [busy, setBusy] = useState(null)        // which export is running
  const [exportOk, setExportOk] = useState(null)
  const [importError, setImportError]     = useState(null)
  const [importPending, setImportPending] = useState(null) // validated data awaiting confirm
  const fileInputRef = useRef(null)

  // ── Tema ──────────────────────────────────────────────────
  const [theme, setThemeState] = useState(getStoredTheme)
  function changeTheme(t) { setTheme(t); setThemeState(t) }

  // ── Backups diários ───────────────────────────────────────
  const [backups, setBackups]             = useState([])
  const [restoreArm, setRestoreArm]       = useState(null) // nome armado p/ confirmação
  const [restoring, setRestoring]         = useState(false)
  const [restoreError, setRestoreError]   = useState(null)

  function loadBackups() {
    window.api.listBackups('data.json').then(setBackups).catch(() => setBackups([]))
  }
  useEffect(() => {
    if (!isElectron) return
    loadBackups()
  }, [])  

  // Nome "data-YYYY-MM-DD.json" → data legível
  function backupDate(name) {
    const m = name.match(/(\d{4}-\d{2}-\d{2})/)
    return m ? new Date(m[1]).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }) : name
  }

  async function restoreBackup(name) {
    if (restoreArm !== name) {
      setRestoreArm(name)
      setTimeout(() => setRestoreArm(c => (c === name ? null : c)), 4000)
      return
    }
    setRestoring(true)
    setRestoreError(null)
    const ok = await window.api.restoreBackup(name, 'data.json')
    if (ok) {
      // Recarrega a app do zero: re-lê config/estado de encriptação e o
      // data.json restaurado (com encriptação ativa volta ao gate).
      window.location.reload()
    } else {
      setRestoring(false)
      setRestoreArm(null)
      setRestoreError('Não foi possível restaurar este backup (incompatível com o modo de encriptação atual, ou ficheiro ilegível).')
    }
  }

  async function doExport(type) {
    setBusy(type)
    setExportOk(null)
    try {
      let content, filename, mimeType, filters
      if (type === 'holdings') {
        content  = exportHoldingsCSV(data)
        filename = `thrive-posicoes-${today()}.csv`
        mimeType = 'text/csv;charset=utf-8;'
        filters  = [{ name: 'CSV', extensions: ['csv'] }]
      } else if (type === 'summary') {
        content  = exportAnnualSummaryCSV(data)
        filename = `thrive-resumo-anual-${today()}.csv`
        mimeType = 'text/csv;charset=utf-8;'
        filters  = [{ name: 'CSV', extensions: ['csv'] }]
      } else if (type === 'report') {
        const reportYear = data?.currentYear ?? new Date().getFullYear()
        content  = buildAnnualReportHTML(data, reportYear)
        filename = `thrive-relatorio-${reportYear}.html`
        mimeType = 'text/html;charset=utf-8;'
        filters  = [{ name: 'HTML', extensions: ['html'] }]
      } else {
        content  = exportFullJSON(data)
        filename = `thrive-export-${today()}.json`
        mimeType = 'application/json'
        filters  = [{ name: 'JSON', extensions: ['json'] }]
      }
      const result = await saveFile({ filename, content, mimeType, filters })
      if (result?.ok !== false) setExportOk(type)
    } catch (e) {
      console.warn('[Thrive] Export falhou:', e)  
    } finally {
      setBusy(null)
    }
  }

  function parseAndValidate(content) {
    const raw = JSON.parse(content)
    const { _exportedAt: _ea, _exportVersion: _ev, ...rest } = raw
    const { data: migrated } = applyMigrations(rest)
    validateData(migrated, 'load')
    return migrated
  }

  async function doImportElectron() {
    setImportError(null)
    const result = await window.api.showOpenDialog({ filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (!result.ok) return
    try {
      setImportPending(parseAndValidate(result.content))
    } catch (e) {
      setImportError(`Ficheiro inválido: ${e.message}`)
    }
  }

  // ── Import XTB (.xlsx) ────────────────────────────────────
  const [xtbParsed, setXtbParsed] = useState(null) // dados parseados à espera de confirmação
  const [xtbError, setXtbError]   = useState(null)
  const xtbFileRef = useRef(null)

  async function parseXtbBase64(base64) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(base64, { type: 'base64' })
    const sheets = Object.fromEntries(
      wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })]))
    const parsed = parseXtb(sheets)
    if (!parsed.buys.length && !parsed.sells.length && !parsed.dividends.length) {
      setXtbError('Nenhuma operação reconhecida — é um extrato XTB (.xlsx)?')
      return
    }
    setXtbError(null)
    setXtbParsed(parsed)
  }

  async function doImportXtb() {
    setXtbError(null)
    if (isElectron) {
      const result = await window.api.showOpenDialog({
        filters: [{ name: 'Excel', extensions: ['xlsx'] }], encoding: 'base64',
      })
      if (!result.ok) return
      try { await parseXtbBase64(result.content) }
      catch (e) { setXtbError(`Ficheiro ilegível: ${e.message}`) }
    } else {
      xtbFileRef.current?.click()
    }
  }

  function doImportXtbWeb(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const base64 = String(ev.target.result).split(',')[1]
        await parseXtbBase64(base64)
      } catch (err) { setXtbError(`Ficheiro ilegível: ${err.message}`) }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function applyXtb(patch, counts) {
    await saveData(patch)
    toastBus.emit(`XTB importado: ${counts.buys} compras, ${counts.sells} vendas, ${counts.dividends} dividendos${counts.skipped ? ` (${counts.skipped} já existiam)` : ''}.`)
  }

  function doImportWeb(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        setImportPending(parseAndValidate(ev.target.result))
      } catch (err) {
        setImportError(`Ficheiro inválido: ${err.message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const EXPORTS = [
    {
      type: 'holdings',
      icon: Table,
      title: 'Posições (CSV)',
      description: 'Ações, ETFs e crypto — todas as posições com custo médio',
      filename: `thrive-posicoes-${today()}.csv`,
    },
    {
      type: 'summary',
      icon: Table,
      title: 'Resumo anual (CSV)',
      description: 'Instantâneos mensais por categoria e total de património',
      filename: `thrive-resumo-anual-${today()}.csv`,
    },
    {
      type: 'report',
      icon: FileText,
      title: 'Relatório anual (HTML)',
      description: 'Resumo do ano corrente: património, ganhos e IRS — abre no browser e imprime para PDF',
      filename: `thrive-relatorio-${data?.currentYear ?? new Date().getFullYear()}.html`,
    },
    {
      type: 'json',
      icon: FileJson,
      title: 'Dados completos (JSON)',
      description: 'Export total compatível com importação validada',
      filename: `thrive-export-${today()}.json`,
    },
  ]

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
        Definições
      </h1>
      <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        Exportação e importação de dados. A tua pasta de dados fica em{' '}
        <code style={{ fontSize: '0.75rem', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>
          ThriveData/
        </code>
        .
      </p>

      {/* Aparência */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Aparência</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'dark',  label: 'Escuro', icon: Moon },
            { id: 'light', label: 'Claro',  icon: Sun },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => changeTheme(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                background: theme === id ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                border: theme === id ? '1px solid rgba(129,140,248,0.4)' : '1px solid var(--border)',
                borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: theme === id ? 700 : 400,
                color: theme === id ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 8 }}>
          Preferência guardada neste dispositivo. O tema claro é recente — se encontrares algum canto ilegível, avisa.
        </p>

        <CategoryColors />
      </section>

      {/* Keyboard shortcuts reference */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Atalhos de teclado</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['Ctrl + K', 'Pesquisa global'],
            ['Ctrl + Z', 'Desfazer última alteração'],
            ['Ctrl + S', 'Guardar checkpoint'],
            ['Ctrl + 1 … 9', 'Navegar entre páginas'],
          ].map(([shortcut, desc]) => (
            <div key={shortcut} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <code style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                {shortcut}
              </code>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Export section */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Exportar</h2>
          {exportOk && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#4ade80' }}>
              <CheckCircle size={12} /> Ficheiro guardado
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXPORTS.map(({ type, icon, title, description }) => (
            <ExportCard
              key={type}
              icon={icon}
              title={title}
              description={description}
              loading={busy === type}
              onExport={() => doExport(type)}
            />
          ))}
        </div>
      </section>

      {/* Backups diários */}
      {isElectron && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Backups diários</h2>
            <button onClick={loadBackups} title="Atualizar a lista"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
              <RotateCcw size={12} />
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            Um snapshot por dia (últimos 30), criado automaticamente a cada gravação. Restaurar substitui os dados atuais pelo desse dia.
          </p>
          {restoreError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, marginBottom: 12 }}>
              <X size={13} color="var(--red)" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>{restoreError}</span>
            </div>
          )}
          {backups.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', opacity: 0.7 }}>Ainda não existem backups.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {backups.map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <Archive size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{backupDate(name)}</span>
                  <Button size="sm" variant={restoreArm === name ? 'danger' : 'ghost'}
                    loading={restoring && restoreArm === name}
                    onClick={() => restoreBackup(name)}
                    title={restoreArm === name ? 'Clica de novo para confirmar — substitui os dados atuais' : 'Restaurar os dados deste dia'}>
                    <RotateCcw size={12} style={{ marginRight: 5 }} />
                    {restoreArm === name ? 'Confirmar?' : 'Restaurar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Atualizações automáticas */}
      {isElectron && <UpdatesSection />}

      {/* Import section */}
      <section>
        <h2 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Importar</h2>

        {/* Pasta Inbox */}
        {isElectron && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FolderInput size={17} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Pasta Inbox</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Larga extratos XTB (.xlsx) em <code style={{ fontSize: '0.7rem' }}>ThriveData/Inbox</code> — ao arrancar,
                a app propõe a importação com preview linha a linha. Nada entra sem confirmares.
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => window.api.openInboxFolder()}>
              Abrir pasta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('thrive-check-inbox'))}>
              Verificar agora
            </Button>
          </div>
        )}

        {/* Import XTB */}
        <div style={{ padding: '20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={17} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Importar extrato XTB (.xlsx)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cria compras, vendas e dividendos automaticamente a partir do extrato (zip anual ou statement).
                Reimportar ficheiros sobrepostos não duplica nada.
              </div>
            </div>
          </div>
          {xtbError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, marginBottom: 14 }}>
              <X size={13} color="var(--red)" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>{xtbError}</span>
            </div>
          )}
          <input ref={xtbFileRef} type="file" accept=".xlsx" onChange={doImportXtbWeb} style={{ display: 'none' }} />
          <Button variant="ghost" onClick={doImportXtb}>
            <Upload size={13} style={{ marginRight: 6 }} />
            Escolher extrato…
          </Button>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={17} color="#fbbf24" />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Importar dados JSON
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Aceita o formato exportado pelo Thrive. Os dados actuais são substituídos após confirmação.
              </div>
            </div>
          </div>

          {importError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, marginBottom: 14 }}>
              <X size={13} color="var(--red)" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>{importError}</span>
            </div>
          )}

          {isElectron ? (
            <Button variant="ghost" onClick={doImportElectron}>
              <Upload size={13} style={{ marginRight: 6 }} />
              Escolher ficheiro…
            </Button>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={doImportWeb}
                style={{ display: 'none' }}
              />
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} style={{ marginRight: 6 }} />
                Escolher ficheiro…
              </Button>
            </>
          )}
        </div>
      </section>

      {importPending && (
        <ConfirmImportModal
          importedData={importPending}
          onConfirm={importData}
          onClose={() => setImportPending(null)}
        />
      )}

      {xtbParsed && (
        <XtbImportModal
          data={data}
          parsed={xtbParsed}
          onApply={applyXtb}
          onClose={() => setXtbParsed(null)}
        />
      )}
    </div>
  )
}
