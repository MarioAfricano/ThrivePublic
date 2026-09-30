import { useState } from 'react'
import { FolderOpen, Check, ArrowRight, Shield, Upload, Zap } from 'lucide-react'

const isElectron = typeof window !== 'undefined' && !!window.api

export default function Setup({ onComplete }) {
  const [step, setStep] = useState(1)
  const [selectedPath, setSelectedPath] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSelectFolder() {
    if (!isElectron) {
      setSelectedPath('C:\\Users\\Mario\\OneDrive')
      return
    }
    const path = await window.api.selectFolder()
    if (path) {
      setSelectedPath(path)
      setError(null)
    }
  }

  async function handleFinish() {
    if (!selectedPath) {
      setError('Por favor seleciona uma pasta primeiro.')
      return
    }
    setLoading(true)
    try {
      await onComplete(selectedPath)
    } catch {
      setError('Erro ao configurar a pasta. Tenta novamente.')
      setLoading(false)
    }
  }

  const features = [
    { icon: Upload, title: 'OneDrive sync',  desc: 'Os dados ficam na tua pasta OneDrive para não se perderem' },
    { icon: Shield,      title: 'Privado',        desc: 'Tudo local, sem nenhum dado enviado para servidores externos' },
    { icon: Zap,         title: 'Rápido',         desc: 'Interface moderna e fluída para o teu dia-a-dia' },
  ]

  return (
    <div style={{
      height: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 40, overflow: 'auto',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: '#fff',
          margin: '0 auto 20px',
          boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
        }}>
          T
        </div>
        <h1 style={{
          fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em',
          background: 'linear-gradient(135deg, #fff 0%, #a1a1aa 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', marginBottom: 8,
        }}>
          Bem-vindo ao Thrive
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto' }}>
          A tua app de finanças pessoais. Vamos configurar em 30 segundos.
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '36px 40px',
        width: '100%',
        maxWidth: 500,
        boxShadow: 'var(--shadow-lg)',
      }}>
        {step === 1 ? (
          /* Step 1: Features overview */
          <>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
              Antes de começar
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--accent-dim)', border: '1px solid rgba(129,140,248,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={15} color="var(--accent)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%', padding: '12px 24px',
                background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                border: 'none', borderRadius: 10, cursor: 'pointer',
                color: '#fff', fontSize: '0.9rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.15s',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Começar configuração
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          /* Step 2: Folder selection */
          <>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Escolher pasta de dados
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              Seleciona a tua pasta <strong style={{ color: 'var(--text-secondary)' }}>OneDrive</strong> (ou qualquer pasta de backup).
              Os dados ficam guardados ali em formato JSON, sempre acessíveis.
            </p>

            {/* Folder selector */}
            <button
              onClick={handleSelectFolder}
              style={{
                width: '100%', padding: '14px 16px',
                background: selectedPath ? 'rgba(74,222,128,0.06)' : 'var(--bg-elevated)',
                border: `1px solid ${selectedPath ? 'rgba(74,222,128,0.3)' : 'var(--border-strong)'}`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!selectedPath) e.currentTarget.style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { if (!selectedPath) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
            >
              {selectedPath ? (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={16} color="var(--green)" />
                </div>
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FolderOpen size={16} color="var(--accent)" />
                </div>
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontSize: '0.825rem', fontWeight: 600, color: selectedPath ? 'var(--green)' : 'var(--text)', marginBottom: 2 }}>
                  {selectedPath ? 'Pasta selecionada' : 'Clica para selecionar pasta'}
                </p>
                <p style={{
                  fontSize: '0.72rem', color: 'var(--text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {selectedPath || 'Exemplo: C:\\Users\\Mario\\OneDrive'}
                </p>
              </div>
            </button>

            {error && (
              <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 12, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 7 }}>
                {error}
              </p>
            )}

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 24 }}>
              📁 Será criada uma subpasta <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem' }}>ThriveData/</code> dentro da pasta escolhida.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '11px 20px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500,
                }}
              >
                Voltar
              </button>
              <button
                onClick={handleFinish}
                disabled={!selectedPath || loading}
                style={{
                  flex: 1, padding: '11px 24px',
                  background: selectedPath ? 'linear-gradient(135deg, #818cf8, #6366f1)' : 'var(--bg-elevated)',
                  border: 'none', borderRadius: 10,
                  cursor: selectedPath ? 'pointer' : 'not-allowed',
                  color: selectedPath ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.9rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s',
                  boxShadow: selectedPath ? '0 4px 16px rgba(99,102,241,0.35)' : 'none',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'A guardar...' : (
                  <>
                    Começar a usar
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer note */}
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 24, textAlign: 'center' }}>
        Os teus dados financeiros nunca saem do teu computador.
      </p>
    </div>
  )
}
