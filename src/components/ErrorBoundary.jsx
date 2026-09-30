import { Component } from 'react'
import { AlertTriangle, RefreshCcw, Copy, ChevronDown, ChevronUp } from 'lucide-react'

// ── ErrorBoundary ──────────────────────────────────────────────
// Captura erros de render/lifecycle descendentes e apresenta um
// fallback em vez de deixar a árvore inteira partir.
//
// Props
// ─────
//   name       — identificador usado no log (ex.: 'page:dashboard', 'chart:savings').
//   variant    — 'page' (default) | 'chart' | 'bare'
//                  page  → ecrã inteiro com stack trace e botão "copiar detalhe"
//                  chart → placeholder pequeno dentro do espaço onde estava o gráfico
//                  bare  → devolve null (silenciar)
//   children   — conteúdo a proteger.
//   fallback   — (erro, reset) => node; override completo do render de fallback.
//   onReset    — opcional; chamado quando o user clica em "Tentar de novo".
//
// Quando há erro, o componente envia {name, message, stack, componentStack}
// para `window.api.logError` — complementa o event log com um canal dedicado
// a crashes do renderer. Fora de Electron, só faz console.error.
const isElectron = typeof window !== 'undefined' && !!window.api

export class ErrorBoundary extends Component {
  state = { error: null, info: null, expanded: false, copied: false }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    const payload = {
      name: this.props.name || 'unknown',
      message: error?.message || String(error),
      stack: error?.stack || null,
      componentStack: info?.componentStack || null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }
    // Log para terminal sempre, para dev mode vê-se logo
    console.error(`[ErrorBoundary:${payload.name}]`, error, info)
    if (isElectron && window.api?.logError) {
      window.api.logError(payload).catch(() => {})
    }
  }

  reset = () => {
    this.setState({ error: null, info: null, expanded: false, copied: false })
    this.props.onReset?.()
  }

  copyDetail = () => {
    const { error, info } = this.state
    const detail = [
      `[ErrorBoundary: ${this.props.name || 'unknown'}]`,
      `Mensagem: ${error?.message || String(error)}`,
      '',
      'Stack:',
      error?.stack || '(sem stack)',
      '',
      'Component stack:',
      info?.componentStack || '(sem component stack)',
    ].join('\n')
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(detail).then(() => {
        this.setState({ copied: true })
        setTimeout(() => this.setState({ copied: false }), 1500)
      }).catch(() => {})
    }
  }

  render() {
    const { error, info, expanded, copied } = this.state
    if (!error) return this.props.children

    // Override total
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    const variant = this.props.variant || 'page'

    if (variant === 'bare') return null

    if (variant === 'chart') {
      return (
        <div style={{
          height: '100%',
          minHeight: 80,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6,
          padding: 12,
          border: '1px dashed rgba(239,68,68,0.3)',
          borderRadius: 8,
          background: 'rgba(239,68,68,0.04)',
          color: '#ef4444',
        }}>
          <AlertTriangle size={16} />
          <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>Gráfico indisponível</div>
          <button
            onClick={this.reset}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.65rem',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            title={error.message}>
            <RefreshCcw size={10} /> tentar novamente
          </button>
        </div>
      )
    }

    // variant === 'page'
    return (
      <div style={{
        padding: '40px 32px',
        maxWidth: 780,
        margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{
          padding: '20px 22px',
          borderRadius: 12,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'flex-start', gap: 14,
        }}>
          <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ef4444' }}>
              Algo correu mal nesta página
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6, wordBreak: 'break-word' }}>
              {error.message || String(error)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Os teus dados estão seguros — o erro ficou circunscrito a esta página.
              Podes tentar navegar para outra secção ou recarregar esta.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={this.reset}
            style={buttonStyle('accent')}>
            <RefreshCcw size={13} /> Tentar de novo
          </button>
          <button
            onClick={this.copyDetail}
            style={buttonStyle('ghost')}>
            <Copy size={13} /> {copied ? 'Copiado!' : 'Copiar detalhe'}
          </button>
          <button
            onClick={() => this.setState({ expanded: !expanded })}
            style={buttonStyle('ghost')}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Ocultar detalhe técnico' : 'Mostrar detalhe técnico'}
          </button>
        </div>

        {expanded && (
          <div style={{
            padding: 14,
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
            maxHeight: 340,
            overflow: 'auto',
          }}>
            <strong style={{ color: 'var(--text)' }}>Stack</strong>
            {'\n'}
            {error.stack || '(sem stack)'}
            {info?.componentStack && (
              <>
                {'\n\n'}
                <strong style={{ color: 'var(--text)' }}>Component stack</strong>
                {info.componentStack}
              </>
            )}
          </div>
        )}

        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, opacity: 0.6 }}>
          Este incidente ficou registado em <code style={{ color: 'var(--text-muted)' }}>ThriveData/errors.log</code>.
          Se for reproducível, copia o detalhe e abre um issue.
        </p>
      </div>
    )
  }
}

function buttonStyle(kind) {
  const isAccent = kind === 'accent'
  return {
    background: isAccent ? 'var(--accent)' : 'transparent',
    border: `1px solid ${isAccent ? 'var(--accent)' : 'var(--border)'}`,
    color: isAccent ? '#fff' : 'var(--text-secondary)',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}

export default ErrorBoundary
