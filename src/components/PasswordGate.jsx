import { useState } from 'react'
import { Lock, Eye, EyeOff, Key } from 'lucide-react'
import Button from './ui/Button.jsx'

const _logos = import.meta.glob('../assets/logo.{png,svg,jpg,jpeg,ico,webp}', { eager: true })
const appLogoSrc = Object.values(_logos)[0]?.default ?? null

// ── Password unlock screen ───────────────────────────────────────
// Shown at startup when data.json is encrypted. User enters their
// password (or recovery code) to decrypt and load their data.
export default function PasswordGate({ onUnlock }) {
  const [mode, setMode]         = useState('password') // 'password' | 'recovery'
  const [value, setValue]       = useState('')
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    const result = await onUnlock(value.trim(), mode === 'recovery')
    setLoading(false)
    if (!result.ok) setError(result.error || 'Erro desconhecido')
  }

  return (
    <div style={{
      height: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 40,
    }}>
      {/* Branding */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        {appLogoSrc
          ? <img src={appLogoSrc} alt="Thrive" style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px', display: 'block', objectFit: 'contain' }} />
          : <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#818cf8,#6366f1)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff' }}>T</div>
        }
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.03em' }}>Dados protegidos</h1>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Introduz a tua password para continuar</p>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '32px 36px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          {mode === 'password'
            ? <Lock size={15} color="var(--accent)" />
            : <Key  size={15} color="#f59e0b" />
          }
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {mode === 'password' ? 'Password' : 'Código de recuperação'}
          </span>
        </div>

        <form onSubmit={submit}>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              autoFocus
              type={show ? 'text' : 'password'}
              value={value}
              onChange={e => { setValue(e.target.value); setError(null) }}
              placeholder={mode === 'password' ? '••••••••' : 'XXXXXXXX XXXXXXXX XXXXXXXX …'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '11px 40px 11px 14px',
                background: 'var(--bg-elevated)', border: `1px solid ${error ? 'var(--red)' : 'var(--border-strong)'}`,
                borderRadius: 10, color: 'var(--text)', fontSize: '0.9rem',
                outline: 'none', fontFamily: 'monospace',
              }}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {error && (
            <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 12, padding: '7px 10px', background: 'rgba(248,113,113,0.08)', borderRadius: 7 }}>
              {error}
            </p>
          )}

          <Button type="submit" fullWidth loading={loading} disabled={!value.trim() || loading}
            style={{ marginBottom: 14 }}>
            {loading ? 'A desencriptar…' : 'Desbloquear'}
          </Button>
        </form>

        <button
          onClick={() => { setMode(m => m === 'password' ? 'recovery' : 'password'); setValue(''); setError(null) }}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '4px 0' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {mode === 'password' ? 'Usar código de recuperação' : 'Usar password'}
        </button>
      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 20, opacity: 0.5 }}>
        Os teus dados financeiros estão encriptados localmente com AES-256-GCM.
      </p>
    </div>
  )
}
