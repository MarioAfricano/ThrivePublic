import { useState } from 'react'
import { Lock, Unlock, Key, Eye, EyeOff, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle, Copy, Check, Timer } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'

const isElectron = typeof window !== 'undefined' && !!window.api

function PasswordInput({ value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        autoFocus={autoFocus}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '••••••••'}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 38px 10px 12px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
          borderRadius: 8, color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
        }}
      />
      <button type="button" onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  )
}

// ── Modal: Enable encryption ────────────────────────────────────
function EnableModal({ onClose, onDone }) {
  const [pass1, setPass1]     = useState('')
  const [pass2, setPass2]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [recovery, setRecovery] = useState(null)
  const [copied, setCopied]   = useState(false)

  const mismatch = pass1 && pass2 && pass1 !== pass2
  const valid    = pass1.length >= 6 && pass1 === pass2

  async function handleEnable() {
    if (!valid) return
    setLoading(true)
    setError(null)
    const result = await window.api.enableEncryption(pass1)
    setLoading(false)
    if (result.ok) {
      setRecovery(result.recoveryCode)
    } else {
      setError(result.error)
    }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(recovery); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} // eslint-disable-line no-empty
  }

  if (recovery) {
    return (
      <Modal onClose={() => { onDone(); onClose() }} width={480}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ShieldCheck size={18} color="var(--green)" />
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Encriptação ativada</h3>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Os teus dados estão agora protegidos. <strong style={{ color: '#fbbf24' }}>Guarda o código de recuperação abaixo em local seguro (offline).</strong>{' '}
          Sem ele, não consegues recuperar os dados se perderes a password.
        </p>

        <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.68rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Código de Recuperação</p>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text)', letterSpacing: '0.08em', wordBreak: 'break-all' }}>{recovery}</p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Button variant="ghost" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copyCode}
            style={{ flex: 1 }}>
            {copied ? 'Copiado!' : 'Copiar código'}
          </Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, marginBottom: 20 }}>
          <AlertTriangle size={14} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--red)', lineHeight: 1.5 }}>
            Este código não volta a ser mostrado. Imprime-o ou guarda-o num gestor de passwords.
          </p>
        </div>

        <Button fullWidth onClick={() => { onDone(); onClose() }} style={{ background: 'var(--green)', border: 'none', color: '#000' }}>
          Já guardei o código — Fechar
        </Button>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} width={420}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Lock size={16} color="var(--accent)" />
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Ativar encriptação</h3>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        O ficheiro de dados será encriptado com AES-256-GCM. Vais precisar desta password (ou do código de recuperação) para abrir a app.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Nova password (mín. 6 caracteres)</label>
          <PasswordInput value={pass1} onChange={setPass1} autoFocus />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Confirmar password</label>
          <PasswordInput value={pass2} onChange={setPass2} />
          {mismatch && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--red)' }}>As passwords não coincidem</p>}
        </div>
      </div>

      {error && <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button loading={loading} disabled={!valid || loading} onClick={handleEnable}
          style={{ flex: 1, background: valid ? 'var(--accent)' : undefined }}>
          Encriptar dados
        </Button>
      </div>
    </Modal>
  )
}

// ── Modal: Disable encryption ────────────────────────────────────
function DisableModal({ onClose, onDone }) {
  const [pass, setPass]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleDisable() {
    if (!pass) return
    setLoading(true)
    setError(null)
    const result = await window.api.disableEncryption(pass)
    setLoading(false)
    if (result.ok) { onDone(); onClose() }
    else setError(result.error)
  }

  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <ShieldOff size={16} color="var(--red)" />
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Desativar encriptação</h3>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Confirma a tua password para remover a proteção. O ficheiro voltará a ser guardado em texto claro.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Password atual</label>
        <PasswordInput value={pass} onChange={setPass} autoFocus />
      </div>
      {error && <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button loading={loading} disabled={!pass || loading} onClick={handleDisable}
          style={{ flex: 1, background: '#ef4444', border: 'none', color: '#fff' }}>
          Remover proteção
        </Button>
      </div>
    </Modal>
  )
}

// ── Modal: Change password ───────────────────────────────────────
function ChangePassModal({ onClose }) {
  const [oldPass, setOldPass] = useState('')
  const [pass1, setPass1]     = useState('')
  const [pass2, setPass2]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [done, setDone]       = useState(false)

  const mismatch = pass1 && pass2 && pass1 !== pass2
  const valid    = oldPass && pass1.length >= 6 && pass1 === pass2

  async function handleChange() {
    if (!valid) return
    setLoading(true)
    setError(null)
    const result = await window.api.changePassword(oldPass, pass1)
    setLoading(false)
    if (result.ok) setDone(true)
    else setError(result.error)
  }

  if (done) {
    return (
      <Modal onClose={onClose} width={360}>
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <ShieldCheck size={32} color="var(--green)" style={{ marginBottom: 12 }} />
          <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Password alterada</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 20 }}>Os dados continuam encriptados com a nova password.</p>
          <Button fullWidth onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <RefreshCw size={15} color="var(--accent)" />
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Alterar password</h3>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Os dados permanecem encriptados — só a password muda.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Password atual</label>
          <PasswordInput value={oldPass} onChange={setOldPass} autoFocus />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Nova password</label>
          <PasswordInput value={pass1} onChange={setPass1} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Confirmar nova password</label>
          <PasswordInput value={pass2} onChange={setPass2} />
          {mismatch && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--red)' }}>As passwords não coincidem</p>}
        </div>
      </div>
      {error && <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button loading={loading} disabled={!valid || loading} onClick={handleChange} style={{ flex: 1 }}>
          Alterar password
        </Button>
      </div>
    </Modal>
  )
}

// ── Modal: Ver código de recuperação ─────────────────────────────
// Mostra o código (= DEK) mediante confirmação da password — para quem
// perdeu o papel. Sem a password não há acesso.
function RecoveryModal({ onClose }) {
  const [pass, setPass]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [code, setCode]       = useState(null)
  const [copied, setCopied]   = useState(false)

  async function handleShow() {
    if (!pass) return
    setLoading(true)
    setError(null)
    const result = await window.api.getRecoveryCode(pass)
    setLoading(false)
    if (result.ok) setCode(result.code)
    else setError(result.error)
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} // eslint-disable-line no-empty
  }

  if (code) {
    return (
      <Modal onClose={onClose} width={480}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Key size={16} color="#fbbf24" />
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Código de recuperação</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Guarda-o em local seguro (offline). Quem tiver este código consegue desencriptar os teus dados sem password.
        </p>
        <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text)', letterSpacing: '0.08em', wordBreak: 'break-all' }}>{code}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copyCode} style={{ flex: 1 }}>
            {copied ? 'Copiado!' : 'Copiar código'}
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Key size={15} color="#fbbf24" />
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>Ver código de recuperação</h3>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Confirma a tua password para revelar o código.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Password atual</label>
        <PasswordInput value={pass} onChange={setPass} autoFocus />
      </div>
      {error && <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button loading={loading} disabled={!pass || loading} onClick={handleShow} style={{ flex: 1 }}>
          Mostrar código
        </Button>
      </div>
    </Modal>
  )
}

// ── Security page ────────────────────────────────────────────────
export default function Security() {
  const { data, saveData, encrypted, setEncrypted } = useApp()
  const [modal, setModal] = useState(null) // 'enable' | 'disable' | 'change' | 'recovery'
  const autoLockMinutes = data?.security?.autoLockMinutes ?? 15

  function setAutoLock(minutes) {
    saveData({ security: { ...(data?.security || {}), autoLockMinutes: minutes } })
  }

  function handleDone(nowEncrypted) {
    setEncrypted(nowEncrypted)
  }

  if (!isElectron) {
    return (
      <div style={{ padding: '32px 28px' }}>
        <h2 style={{ color: 'var(--text)', marginBottom: 8 }}>Segurança</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Encriptação disponível apenas na versão desktop.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 600 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={18} color="var(--accent)" /> Segurança
        </h2>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
          Protege os teus dados financeiros com encriptação local.
        </p>
      </div>

      {/* Status card */}
      <div style={{ background: 'var(--bg-card)', border: `1px solid ${encrypted ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: encrypted ? 'rgba(74,222,128,0.12)' : 'var(--wa-04)', border: `1px solid ${encrypted ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {encrypted ? <ShieldCheck size={18} color="var(--green)" /> : <ShieldOff size={18} color="var(--text-muted)" />}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>
                {encrypted ? 'Encriptação ativa' : 'Sem proteção'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {encrypted ? 'AES-256-GCM · scrypt · data.json encriptado' : 'Os dados estão guardados em texto claro'}
              </p>
            </div>
          </div>
          {encrypted && (
            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600 }}>
              Protegido
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!encrypted ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Lock size={13} color="var(--accent)" /> Ativar encriptação
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Protege o data.json com password. Será pedida ao abrir a app.
              </p>
            </div>
            <Button icon={<Lock size={13} />} onClick={() => setModal('enable')}
              style={{ background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.3)', color: 'var(--accent)', flexShrink: 0 }}>
              Ativar
            </Button>
          </div>
        ) : (
          <>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <RefreshCw size={13} color="var(--accent)" /> Alterar password
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Mantém a encriptação, muda só a password.
                </p>
              </div>
              <Button variant="ghost" icon={<RefreshCw size={13} />} onClick={() => setModal('change')}>
                Alterar
              </Button>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Key size={13} color="#fbbf24" /> Ver código de recuperação
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Perdeste o papel? Revela o código com a password.
                </p>
              </div>
              <Button variant="ghost" icon={<Key size={13} />} onClick={() => setModal('recovery')}>
                Mostrar
              </Button>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Timer size={13} color="var(--accent)" /> Bloqueio automático
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Volta a pedir a password após inatividade.
                </p>
              </div>
              <select value={autoLockMinutes} onChange={e => setAutoLock(Number(e.target.value))}
                style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text)', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}>
                <option value={0}>Desligado</option>
                <option value={5}>5 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
              </select>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Unlock size={13} color="var(--text-muted)" /> Remover encriptação
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  O ficheiro voltará a ser guardado sem proteção.
                </p>
              </div>
              <Button variant="danger" icon={<Unlock size={13} />} onClick={() => setModal('disable')}>
                Remover
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Info box */}
      <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <p style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Key size={11} /> Como funciona
        </p>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <li>A chave de encriptação (DEK) é gerada aleatoriamente e encriptada com a tua password via <strong style={{ color: 'var(--text-secondary)' }}>scrypt</strong>.</li>
          <li>Os dados são encriptados com <strong style={{ color: 'var(--text-secondary)' }}>AES-256-GCM</strong> (encriptação autenticada).</li>
          <li>O código de recuperação é a DEK em texto — guarda-o offline. Sem ele, a perda de password = perda de dados.</li>
          <li>Os backups diários também ficam encriptados.</li>
        </ul>
      </div>

      {/* Modals */}
      {modal === 'enable'   && <EnableModal   onClose={() => setModal(null)} onDone={() => handleDone(true)}  />}
      {modal === 'disable'  && <DisableModal  onClose={() => setModal(null)} onDone={() => handleDone(false)} />}
      {modal === 'change'   && <ChangePassModal onClose={() => setModal(null)} />}
      {modal === 'recovery' && <RecoveryModal   onClose={() => setModal(null)} />}
    </div>
  )
}
