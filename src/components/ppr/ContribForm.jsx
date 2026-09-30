import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { getMK, MONTHS, MONTHS_SHORT, formatEuro } from '../../data/initialData.js'
import { YEAR_OPTIONS } from './constants.js'

// ── Formulário de nova entrega / levantamento ───────────────────
// Usado tanto para criar como para editar. Toggle entrega|levantamento
// só inverte os sinais (negativos nos levantamentos).
// `initialValues` define o modo de edição e preenche os campos.
export default function ContribForm({ onSave, onCancel, currentMK, initialValues }) {
  const iv = initialValues
  const isEdit = !!iv

  // Data: preferir initialValues, senão mês actual.
  const [refY, refM] = (iv?.mk || currentMK).split('-').map(Number)
  const [selYear,  setSelYear]  = useState(refY)
  const [selMonth, setSelMonth] = useState(refM)
  const [selDay,   setSelDay]   = useState(iv?.day || 1)
  const [valorPago,     setValorPago]     = useState(iv ? String(Math.abs(iv.valorPago     || 0)) : '')
  const [valorColocado, setValorColocado] = useState(iv ? String(Math.abs(iv.valorColocado || 0)) : '')
  const [note,          setNote]          = useState(iv?.note || '')
  const [tipo,          setTipo]          = useState(iv && (iv.valorPago || 0) < 0 ? 'levantamento' : 'entrega')

  const isLevantamento = tipo === 'levantamento'

  function submit() {
    const pago     = parseFloat(valorPago.replace(',', '.'))
    const colocado = parseFloat(valorColocado.replace(',', '.'))
    if (isNaN(pago) || pago <= 0) return
    const sign = isLevantamento ? -1 : 1
    onSave({
      id: iv?.id || `c-${Date.now()}`,
      valorPago:     sign * pago,
      valorColocado: sign * (isNaN(colocado) ? pago : colocado),
      mk:   getMK(selYear, selMonth),
      day:  selDay,
      note: note.trim(),
    })
  }

  const selectStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', padding: '6px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer',
  }
  const inputStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', padding: '6px 10px', fontSize: '0.82rem', outline: 'none',
  }

  // Encargos = diferença entre valor pago e valor colocado (só entregas).
  const encargos = (() => {
    const p = parseFloat(valorPago.replace(',', '.'))
    const c = parseFloat(valorColocado.replace(',', '.'))
    if (!isNaN(p) && !isNaN(c) && p !== c) return p - c
    return null
  })()

  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Toggle entrega / levantamento */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[['entrega', 'Entrega'], ['levantamento', 'Levantamento']].map(([val, label]) => (
          <button key={val} onClick={() => setTipo(val)}
            style={{
              padding: '5px 14px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${tipo === val ? (val === 'levantamento' ? 'rgba(239,68,68,0.4)' : 'rgba(129,140,248,0.4)') : 'var(--border)'}`,
              background: tipo === val ? (val === 'levantamento' ? 'rgba(239,68,68,0.1)' : 'rgba(129,140,248,0.1)') : 'transparent',
              color: tipo === val ? (val === 'levantamento' ? 'var(--red)' : 'var(--accent)') : 'var(--text-muted)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Data */}
      <div>
        <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
          Data {isLevantamento ? 'do levantamento' : 'da entrega'}
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={selDay} onChange={e => setSelDay(Number(e.target.value))} style={{ ...selectStyle, width: 64 }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} style={selectStyle}>
            {MONTHS.map((mn, i) => <option key={i} value={i}>{mn}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={selectStyle}>
            {YEAR_OPTIONS.map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>
        {selDay > 1 && (
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 5 }}>
            ℹ️ Dia {selDay} → só conta a partir de {selMonth === 11 ? `Jan ${selYear + 1}` : `${MONTHS_SHORT[selMonth + 1]} ${selYear}`}
          </p>
        )}
      </div>

      {/* Valores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            {isLevantamento ? 'Valor levantado (€)' : 'Valor pago (€)'}
          </label>
          <input value={valorPago} onChange={e => setValorPago(e.target.value)} placeholder="ex: 150.00" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
            style={{ ...inputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            {isLevantamento ? 'Valor retirado do fundo (€)' : 'Valor colocado (€)'}
          </label>
          <input value={valorColocado} onChange={e => setValorColocado(e.target.value)}
            placeholder={isLevantamento ? '= valor levantado' : '= valor pago'}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
            style={{ ...inputStyle, width: '100%' }} />
        </div>
      </div>

      {/* Aviso encargos (só em entrega) */}
      {!isLevantamento && encargos !== null && encargos > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--yellow)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 7, padding: '6px 10px' }}>
          <AlertCircle size={12} />
          Encargos/taxas: {formatEuro(encargos)} (diferença entre pago e colocado)
        </div>
      )}

      {/* Nota */}
      <div>
        <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Nota (opcional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={isLevantamento ? 'ex: Resgate parcial' : 'ex: Entrega mensal'}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
          style={{ ...inputStyle, width: '100%' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={submit}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: isLevantamento ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#818cf8,#6366f1)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
          {isEdit ? 'Guardar alterações' : isLevantamento ? 'Registar levantamento' : 'Guardar entrega'}
        </button>
      </div>
    </div>
  )
}
