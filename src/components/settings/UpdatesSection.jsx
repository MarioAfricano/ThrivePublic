import { useState, useEffect } from 'react'
import { RefreshCw, KeyRound, CheckCircle, X, Download } from 'lucide-react'
import Button from '../ui/Button.jsx'

const isElectron = typeof window !== 'undefined' && !!window.api

// ── Atualizações automáticas (Definições) ───────────────────────
// A app instalada procura versões novas nas GitHub Releases do repo
// privado. Precisa de um token pessoal (fine-grained, só o repo Thrive,
// Contents read/write) que o utilizador cola aqui uma única vez — fica
// guardado localmente no thrive-config.json, nunca sai da máquina.
export default function UpdatesSection() {
  const [version, setVersion]       = useState('')
  const [hasToken, setHasToken]     = useState(false)
  const [tokenDraft, setTokenDraft] = useState('')
  const [status, setStatus]         = useState(null)
  // Feedback imediato ao clicar ('check' | 'install') — os eventos do
  // updater podem demorar uns segundos a chegar do GitHub
  const [busy, setBusy]             = useState(null)

  useEffect(() => {
    if (!isElectron) return
    window.api.getAppVersion?.().then(v => setVersion(v || '')).catch(() => {})
    window.api.getConfig?.().then(c => setHasToken(!!c?.githubToken)).catch(() => {})
    window.api.onUpdateStatus?.(s => {
      setStatus(s)
      if (s?.state !== 'checking') setBusy(null)
    })
  }, [])

  async function saveToken() {
    const t = tokenDraft.trim()
    if (!t) return
    await window.api.saveConfig({ githubToken: t })
    setHasToken(true)
    setTokenDraft('')
    setStatus(null)
  }
  async function removeToken() {
    await window.api.saveConfig({ githubToken: '' })
    setHasToken(false)
    setStatus(null)
  }
  async function check() {
    setBusy('check')
    const r = await window.api.checkUpdates()
    if (!r?.ok) {
      setBusy(null)
      setStatus({ state: 'error', message: r?.reason === 'dev'
        ? 'Só disponível na app instalada (não em modo dev).'
        : 'Cola primeiro o token do GitHub.' })
    }
  }
  function download() {
    // Otimista: mostra já a barra a 0% — o primeiro evento real substitui
    setStatus({ state: 'downloading', percent: 0 })
    window.api.downloadUpdate()
  }
  function install() {
    setBusy('install')
    window.api.installUpdate()
  }

  const st = status?.state

  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        Atualizações {version && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>· v{version}</span>}
      </h2>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 14 }}>
        A app procura versões novas no GitHub ao arrancar e instala-as com um clique.
      </p>

      {!hasToken ? (
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <KeyRound size={14} color="var(--accent)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Ligar ao GitHub (uma vez)</span>
          </div>
          <ol style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>github.com → foto de perfil → <strong>Settings</strong> → <strong>Developer settings</strong> → <strong>Personal access tokens</strong> → <strong>Fine-grained tokens</strong> → <strong>Generate new token</strong></li>
            <li>Repository access: <strong>Only select repositories</strong> → <strong>Thrive</strong></li>
            <li>Permissions → Repository → <strong>Contents: Read and write</strong></li>
            <li>Validade: 1 ano · gera, copia e cola aqui:</li>
          </ol>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={tokenDraft}
              onChange={e => setTokenDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveToken() }}
              placeholder="github_pat_…"
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontSize: '0.78rem', padding: '8px 12px', outline: 'none', fontFamily: 'monospace' }}
            />
            <Button size="sm" onClick={saveToken} disabled={!tokenDraft.trim()}>Guardar</Button>
          </div>
          <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '8px 0 0', opacity: 0.75 }}>
            O token fica só neste computador (thrive-config.json). Dá acesso de leitura/escrita ao repo Thrive — não uses um token com mais permissões do que isto.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
            <CheckCircle size={14} color="var(--green)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>Token configurado</span>
            <Button size="sm" variant="ghost" onClick={check}
              loading={busy === 'check' || st === 'checking'}
              disabled={st === 'downloading'}>
              <RefreshCw size={12} style={{ marginRight: 5 }} />
              Verificar agora
            </Button>
            <Button size="sm" variant="ghost" onClick={removeToken} title="Apaga o token deste computador">Remover token</Button>
          </div>

          {st && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, fontSize: '0.78rem',
              background: st === 'error' ? 'rgba(248,113,113,0.08)' : 'var(--bg-elevated)',
              border: `1px solid ${st === 'error' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}` }}>
              {st === 'checking' && <span style={{ color: 'var(--text-muted)' }}>A verificar…</span>}
              {st === 'none' && <><CheckCircle size={13} color="var(--green)" /><span style={{ color: 'var(--text-secondary)' }}>Estás na versão mais recente.</span></>}
              {st === 'available' && (
                <>
                  <span style={{ color: 'var(--text)', fontWeight: 600, flex: 1 }}>Versão {status.version} disponível</span>
                  <Button size="sm" onClick={download}>
                    <Download size={12} style={{ marginRight: 5 }} /> Descarregar
                  </Button>
                </>
              )}
              {st === 'downloading' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--wa-06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: 'var(--accent)',
                      width: `${status.percent ?? 0}%`, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 78, textAlign: 'right' }}>
                    {(status.percent ?? 0) === 0 ? 'a ligar…' : `${status.percent}%`}
                  </span>
                </div>
              )}
              {st === 'ready' && (
                <>
                  <span style={{ color: 'var(--text)', fontWeight: 600, flex: 1 }}>Versão {status.version} pronta a instalar</span>
                  <Button size="sm" loading={busy === 'install'} onClick={install}>
                    {busy === 'install' ? 'A reiniciar…' : 'Reiniciar e instalar'}
                  </Button>
                </>
              )}
              {st === 'error' && <><X size={13} color="var(--red)" /><span style={{ color: 'var(--red)' }}>{status.message}</span></>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
