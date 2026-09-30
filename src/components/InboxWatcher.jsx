import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { parseXtb } from '../utils/importXtb.js'
import InboxImportModal from './settings/InboxImportModal.jsx'
import { toastBus } from '../utils/toastBus.js'

const isElectron = typeof window !== 'undefined' && !!window.api

// ── Vigia da pasta Inbox ────────────────────────────────────────────
// Ao arrancar (com dados carregados) e quando as Definições disparam o
// evento 'thrive-check-inbox', lista <dataPath>/Inbox, parseia os
// extratos .xlsx e abre a preview (InboxImportModal). Nada é importado
// nem movido sem o utilizador confirmar; "Mais tarde" deixa os
// ficheiros onde estão e volta a propor no próximo arranque.
export default function InboxWatcher() {
  const { data, saveData } = useApp()
  const [preview, setPreview] = useState(null) // { files: [{ name, parsed }] }
  const scannedOnce = useRef(false)

  const scan = useCallback(async (manual) => {
    if (!isElectron || !window.api?.listInbox) return
    const files = await window.api.listInbox()
    if (!files?.length) {
      if (manual) toastBus.emit('Inbox vazia — larga lá extratos .xlsx da XTB e volta a verificar.')
      return
    }
    const XLSX = await import('xlsx')
    const out = []
    for (const f of files) {
      const b64 = await window.api.readInboxFile(f.name)
      if (!b64) continue
      try {
        const wb = XLSX.read(b64, { type: 'base64' })
        const sheets = Object.fromEntries(
          wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })]))
        const parsed = parseXtb(sheets)
        if (!parsed.buys.length && !parsed.sells.length && !parsed.dividends.length) {
          toastBus.emit(`Inbox: «${f.name}» não parece um extrato XTB — fica na pasta, sem importar.`)
          continue
        }
        out.push({ name: f.name, parsed })
      } catch {
        toastBus.emit(`Inbox: não consegui ler «${f.name}» — ficheiro ilegível, fica na pasta.`)
      }
    }
    if (out.length) setPreview({ files: out })
    else if (manual) toastBus.emit('Inbox: nenhum extrato legível para importar.')
  }, [])

  // Arranque: uma única verificação, depois de os dados carregarem
  // (com encriptação, só após o unlock)
  useEffect(() => {
    if (!data || scannedOnce.current) return
    scannedOnce.current = true
    scan(false)
  }, [data, scan])

  // "Verificar agora" nas Definições
  useEffect(() => {
    const h = () => scan(true)
    window.addEventListener('thrive-check-inbox', h)
    return () => window.removeEventListener('thrive-check-inbox', h)
  }, [scan])

  async function handleApply(patch, counts, fileNames) {
    await saveData(patch)
    for (const n of fileNames) await window.api.archiveInboxFile(n)
    toastBus.emit(
      `Inbox: ${counts.buys} compras, ${counts.sells} vendas, ${counts.dividends} dividendos importados` +
      `${counts.skipped ? ` (${counts.skipped} já existiam)` : ''} — extratos arquivados em Inbox/importados.`)
  }

  if (!preview || !data) return null
  return (
    <InboxImportModal
      data={data}
      files={preview.files}
      onApply={handleApply}
      onClose={() => setPreview(null)}
    />
  )
}
