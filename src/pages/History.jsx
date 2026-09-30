import { useState } from 'react'
import { RotateCcw, Trash2, Clock, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

// Cor por categoria de alteração
const LABEL_COLOR = {
  'Bancos':        '#fbbf24',
  'PPR':           '#f472b6',
  'Ações':         '#4ade80',
  'Criptomoeda':   '#f97316',
  'Aforro':        '#60a5fa',
  'Dados anuais':  '#818cf8',
  'Património':    '#a78bfa',
}
function labelColor(label) {
  for (const [k, c] of Object.entries(LABEL_COLOR)) {
    if (label.includes(k)) return c
  }
  return '#71717a'
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(iso) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
}

export default function History() {
  const { history, undoTo } = useApp()
  const [hovered, setHovered] = useState(null)
  const [confirming, setConfirming] = useState(null)

  // Mostrar do mais recente para o mais antigo
  const entries = [...(history || [])].reverse()

  function handleRevert(id) {
    if (confirming === id) {
      undoTo(id)
      setConfirming(null)
    } else {
      setConfirming(id)
    }
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%' }}>

      {/* Cabeçalho */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 4 }}>
          Histórico da sessão
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Alterações feitas desde que abriste a app · {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
        </p>
      </div>

      {entries.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, paddingTop: 60, color: 'var(--text-muted)' }}>
          <Clock size={32} strokeWidth={1.2} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem' }}>Ainda não fizeste nenhuma alteração nesta sessão.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 640 }}>

          {/* Legenda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <RotateCcw size={11} color="var(--text-muted)" />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Clica em "Reverter" para restaurar o estado antes dessa alteração. Todas as alterações mais recentes serão removidas.
            </span>
          </div>

          {entries.map((entry, i) => {
            const color   = labelColor(entry.label)
            const isHov   = hovered === entry.id
            const isCon   = confirming === entry.id
            const isLast  = i === entries.length - 1

            return (
              <div key={entry.id}
                onMouseEnter={() => setHovered(entry.id)}
                onMouseLeave={() => { setHovered(null); if (confirming === entry.id) setConfirming(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px',
                  background: isHov ? 'var(--wa-03)' : 'transparent',
                  borderRadius: 10,
                  transition: 'background 0.15s',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                }}>

                {/* Linha de tempo */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}55` }} />
                  {!isLast && <div style={{ width: 1, height: 28, background: 'var(--border)', marginTop: 3 }} />}
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, color,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      padding: '2px 7px', borderRadius: 4,
                    }}>
                      {entry.label}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {formatDate(entry.timestamp)} · {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  {i === 0 && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      alteração mais recente
                    </span>
                  )}
                </div>

                {/* Botão reverter */}
                {isHov && (
                  <button
                    onClick={() => handleRevert(entry.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 7, border: 'none',
                      cursor: 'pointer', flexShrink: 0,
                      background: isCon ? 'rgba(239,68,68,0.15)' : 'var(--wa-06)',
                      color: isCon ? 'var(--red)' : 'var(--text-secondary)',
                      fontSize: '0.72rem', fontWeight: isCon ? 700 : 400,
                      transition: 'all 0.15s',
                    }}>
                    {isCon
                      ? <><Trash2 size={11} /> Confirmar</>
                      : <><RotateCcw size={11} /> Reverter</>
                    }
                    {!isCon && <ChevronRight size={10} style={{ opacity: 0.5 }} />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
