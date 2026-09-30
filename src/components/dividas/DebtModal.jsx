import { useState } from 'react'
import { X } from 'lucide-react'
import { getMK, MONTHS } from '../../data/initialData.js'
import { generateId as uid } from '../../utils/id.js'
import Field from './Field.jsx'
import { inputStyle } from './ui.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

// ── Modal: adicionar / editar dívida ─────────────────────────────
// Campos: nome, banco, montante total, prestação base, dia débito,
// mês de início, estado (ativa/liquidada — só na edição).
// Se `debt` vier preenchido estamos a editar; senão, criamos novo
// com pagamentos={} e ativa=true.
export default function DebtModal({ debt, onSave, onClose }) {
  const now = new Date()
  const [form, setForm] = useState({
    nome: debt?.nome || '',
    banco: debt?.banco || '',
    montanteInicial: debt?.montanteInicial != null ? String(debt.montanteInicial) : '',
    prestacaoMensal: debt?.prestacaoMensal != null ? String(debt.prestacaoMensal) : '',
    diaDebito: debt?.diaDebito != null ? String(debt.diaDebito) : '1',
    inicioYear: debt?.inicioMK ? Number(debt.inicioMK.split('-')[0]) : now.getFullYear(),
    inicioMonth: debt?.inicioMK ? Number(debt.inicioMK.split('-')[1]) : now.getMonth(),
    _inativa: debt ? !debt.ativa : false,
  })

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.montanteInicial || !form.prestacaoMensal) return
    onSave({
      ...(debt || { id: uid(), pagamentos: {}, ativa: true }),
      nome: form.nome.trim(),
      banco: form.banco.trim(),
      montanteInicial: parseFloat(form.montanteInicial) || 0,
      prestacaoMensal: parseFloat(form.prestacaoMensal) || 0,
      diaDebito: Math.min(28, Math.max(1, parseInt(form.diaDebito) || 1)),
      inicioMK: getMK(form.inicioYear, form.inicioMonth),
      ativa: !form._inativa,
    })
  }

  const dia = parseInt(form.diaDebito) || 1
  const diaHint = dia >= 2
    ? `Debitada dia ${dia} — a prestação contabiliza no mês seguinte`
    : `Debitada dia ${dia}`

  return (
    <Modal onClose={onClose} width={440} style={{ padding: '28px 28px 24px' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
        <X size={18} />
      </button>
      <h3 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
        {debt ? 'Editar dívida' : 'Nova dívida'}
      </h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome">
          <input style={inputStyle} value={form.nome} onChange={e => upd('nome', e.target.value)} placeholder="ex: Habitação" required />
        </Field>
        <Field label="Banco / Entidade">
          <input style={inputStyle} value={form.banco} onChange={e => upd('banco', e.target.value)} placeholder="ex: CGD, BPI, Millennium…" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Montante total (€)">
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.montanteInicial} onChange={e => upd('montanteInicial', e.target.value)} placeholder="150 000" required />
          </Field>
          <Field label="Prestação base (€)">
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.prestacaoMensal} onChange={e => upd('prestacaoMensal', e.target.value)} placeholder="650" required />
          </Field>
        </div>
        <Field label="Dia de débito (1–28)" hint={diaHint}>
          <input style={inputStyle} type="number" min="1" max="28" value={form.diaDebito} onChange={e => upd('diaDebito', e.target.value)} />
        </Field>
        <Field label="Início do empréstimo">
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
            <input style={inputStyle} type="number" min="2000" max="2100" value={form.inicioYear} onChange={e => upd('inicioYear', parseInt(e.target.value) || now.getFullYear())} placeholder="Ano" />
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.inicioMonth} onChange={e => upd('inicioMonth', parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
        </Field>
        {debt && (
          <Field label="Estado">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!form._inativa} onChange={e => upd('_inativa', !e.target.checked)} style={{ accentColor: '#ef4444' }} />
              Empréstimo ativo
            </label>
          </Field>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" style={{ background: '#ef4444', border: 'none', color: '#fff' }}>
            {debt ? 'Guardar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
