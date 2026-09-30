import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { runAllChecks } from '../utils/healthChecks.js'
import {
  Heart, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle,
  ChevronDown, ChevronUp, Wrench,
} from 'lucide-react'

// ── Página Saúde ────────────────────────────────────────────────
// Corre `runAllChecks` contra o `data` actual e mostra cada invariante
// numa linha com estado (OK / aviso / erro), contagem e detalhes expandíveis.
// Checks fixáveis mostram um botão "Corrigir" que chama `fix(data)` e
// passa o patch directamente para `saveData`.
export default function Saude() {
  const { data, saveData } = useApp()
  const [refreshKey, setRefreshKey] = useState(0)
  const [expanded, setExpanded] = useState({})

  // `refreshKey` força re-execução manual: alguns checks dependem da data real
  const results = useMemo(() => { void refreshKey; return runAllChecks(data) }, [data, refreshKey])

  const totalOk     = results.filter(r => r.ok).length
  const totalIssues = results.reduce((s, r) => s + r.issues.length, 0)
  const worst = results.reduce((w, r) => {
    if (r.ok) return w
    if (r.severity === 'error') return 'error'
    if (w !== 'error' && r.severity === 'warning') return 'warning'
    return w
  }, 'ok')

  function toggleExpand(id) { setExpanded(x => ({ ...x, [id]: !x[id] })) }

  function runFix(check) {
    if (!check.fix) return
    const patch = check.fix(data)
    saveData(patch)
    // `data` muda → `results` recalcula via useMemo
  }

  // ── Estilos ──────────────────────────────────────────────
  const severityStyle = {
    ok:      { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.25)' },
    warning: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
    error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  }
  const globalBanner = severityStyle[worst === 'ok' ? 'ok' : worst]

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={22} style={{ color: 'var(--accent)' }} />
            Saúde dos dados
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Verificação de invariantes sobre <code style={{ color: 'var(--text-secondary)' }}>data.json</code>. Corre quando entras na página ou clicas em Atualizar.
          </p>
        </div>

        <button
          onClick={() => setRefreshKey(k => k + 1)}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
          <RefreshCw size={13} />
          Atualizar
        </button>
      </div>

      {/* Banner global */}
      <div style={{
        padding: '14px 18px',
        borderRadius: 10,
        background: globalBanner.bg,
        border: `1px solid ${globalBanner.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {worst === 'ok'
          ? <CheckCircle2 size={22} style={{ color: globalBanner.color, flexShrink: 0 }} />
          : worst === 'error'
            ? <AlertCircle size={22} style={{ color: globalBanner.color, flexShrink: 0 }} />
            : <AlertTriangle size={22} style={{ color: globalBanner.color, flexShrink: 0 }} />}
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: globalBanner.color }}>
            {worst === 'ok'
              ? 'Tudo em ordem'
              : worst === 'error'
                ? 'Problemas graves encontrados'
                : 'Avisos encontrados'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {totalOk} verificações OK · {totalIssues > 0 ? `${totalIssues} problema${totalIssues === 1 ? '' : 's'} em ${results.length - totalOk} verificaç${results.length - totalOk === 1 ? 'ão' : 'ões'}` : 'nenhum problema detectado'}
          </div>
        </div>
      </div>

      {/* Lista de checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map(r => {
          const sev = r.ok ? 'ok' : r.severity
          const st  = severityStyle[sev] || severityStyle.ok
          const isOpen = !!expanded[r.id]
          return (
            <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => !r.ok && toggleExpand(r.id)}
                disabled={r.ok}
                style={{
                  all: 'unset',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  cursor: r.ok ? 'default' : 'pointer',
                  width: '100%', boxSizing: 'border-box',
                }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: 7,
                  background: st.bg, border: `1px solid ${st.border}`,
                  color: st.color, flexShrink: 0,
                }}>
                  {r.ok
                    ? <CheckCircle2 size={14} />
                    : r.severity === 'error' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {r.ok
                      ? 'Passa'
                      : `${r.issues.length} problema${r.issues.length === 1 ? '' : 's'}`}
                    {' · '}
                    <code style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{r.id}</code>
                  </div>
                </div>

                {r.fixable && (
                  <button
                    onClick={e => { e.stopPropagation(); runFix(r) }}
                    style={{
                      background: 'var(--accent-dim)',
                      border: '1px solid rgba(129,140,248,0.3)',
                      color: 'var(--accent)',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                    <Wrench size={11} />
                    Corrigir
                  </button>
                )}

                {!r.ok && (isOpen
                  ? <ChevronUp size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  : <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />)}
              </button>

              {!r.ok && isOpen && (
                <div style={{
                  padding: '0 16px 14px 54px',
                  borderTop: '1px solid var(--wa-04)',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  {r.issues.map((iss, i) => (
                    <div key={i} style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      padding: '6px 0',
                      borderBottom: i < r.issues.length - 1 ? '1px dashed var(--wa-05)' : 'none',
                    }}>
                      <span style={{ color: st.color, marginRight: 6 }}>•</span>
                      {iss.message}
                      {iss.path && (
                        <code style={{
                          display: 'block', fontSize: '0.62rem',
                          color: 'var(--text-muted)', marginTop: 2, marginLeft: 12,
                          opacity: 0.7,
                        }}>
                          {iss.path}
                        </code>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Rodapé */}
      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, opacity: 0.6 }}>
        As correções automáticas aplicam-se instantaneamente e ficam registadas no histórico (podes desfazer em <strong style={{ color: 'var(--text-muted)' }}>Histórico</strong>). Se uma verificação não tiver botão <strong style={{ color: 'var(--text-muted)' }}>Corrigir</strong>, é porque depende de informação externa (ex.: taxas de câmbio em falta) e precisa de intervenção manual.
      </p>
    </div>
  )
}
