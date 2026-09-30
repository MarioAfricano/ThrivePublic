import { useState } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronUp, Gift, ArrowDownUp, Pencil,
} from 'lucide-react'
import {
  formatEuro, getMK, MONTHS_SHORT, compareMK,
  getPPRAccData, isContribActiveForMK,
} from '../../data/initialData.js'
import { EditableField } from '../ui/EditableField.jsx'
import ContribForm from './ContribForm.jsx'
import PrevYearSummaryRow from './PrevYearSummaryRow.jsx'

// ── Linha de conta PPR ───────────────────────────────────────────
// Cada conta tem saldo editável (override via monthData[mk]) e
// lista de contribuições (entregas/levantamentos). Painel expansível
// mostra histórico do ano actual + totais. Em Janeiro mostra linha
// dourada com resumo do ano anterior (editável, serve de override
// para o "Total pago" acumulado).
export default function PPRAccountRow({ account, mk, onUpdate, onRemove }) {
  const [showContribs,   setShowContribs]   = useState(false)
  const [addingContrib,  setAddingContrib]  = useState(false)
  const [editingContrib, setEditingContrib] = useState(null) // contrib a editar

  const accData       = getPPRAccData(account, mk)
  const balance       = accData.balance || 0
  const contributions = account.contributions || []

  const [mkYear, mkMonth] = mk.split('-').map(Number)
  const isJanuary = mkMonth === 0

  // Todas as contribuições ordenadas (para estatísticas acumuladas)
  const allSorted = [...contributions].sort((a, b) => {
    const mkCmp = compareMK(a.mk, b.mk)
    return mkCmp !== 0 ? mkCmp : (a.day || 1) - (b.day || 1)
  })

  // Só contribuições do ano actual (para a lista).
  const sortedContribs = allSorted.filter(c => {
    const [cy] = c.mk.split('-').map(Number)
    return cy === mkYear
  })

  // prevDecData necessário para override de activePago — calcular antes.
  const prevDecMK   = getMK(mkYear - 1, 11) // Dezembro do ano anterior
  const prevDecData = account.monthData?.[prevDecMK] || {}

  // Contribuições activas acumuladas (todos os anos) — p/ header "Total pago".
  const activeContribs = allSorted.filter(c => isContribActiveForMK(c, mk))

  // Se manualTotalPago definido, substitui a soma das contribs de anos
  // anteriores — o utilizador define "Colocado" no resumo de ano
  // anterior → reflecte em "Total pago".
  const manualPagoOverride = prevDecData.manualTotalPago
  const activePago = manualPagoOverride !== undefined
    ? manualPagoOverride + activeContribs
        .filter(c => { const [cy] = c.mk.split('-').map(Number); return cy === mkYear })
        .reduce((s, c) => s + (c.valorPago || 0), 0)
    : activeContribs.reduce((s, c) => s + (c.valorPago || 0), 0)

  // Contribuições activas só do ano actual — para o rodapé da lista.
  const thisYearActive         = sortedContribs.filter(c => isContribActiveForMK(c, mk))
  const thisYearActivePago     = thisYearActive.reduce((s, c) => s + (c.valorPago     || 0), 0)
  const thisYearActiveColocado = thisYearActive.reduce((s, c) => s + (c.valorColocado || 0), 0)

  // Resumo do ano anterior (só visível em Janeiro).
  const prevYearContribs = isJanuary ? contributions.filter(c => { const [cy] = c.mk.split('-').map(Number); return cy < mkYear }) : []
  const computedPrevPago = prevYearContribs.reduce((s, c) => s + (c.valorPago || 0), 0)
  // manualTotalPago prevalece sobre o cálculo automático.
  const prevYearPago    = prevDecData.manualTotalPago !== undefined ? prevDecData.manualTotalPago : computedPrevPago
  const prevYearBalance = isJanuary ? (prevDecData.balance || 0) : 0
  const hasPrevYearSummary = isJanuary // sempre visível em Janeiro

  function saveBalance(val) {
    onUpdate({ ...account, monthData: { ...(account.monthData || {}), [mk]: { balance: val } } })
  }

  // Guarda o saldo do fundo em Dez do ano anterior (campo independente).
  function savePrevYearBalance(val) {
    const existing = account.monthData?.[prevDecMK] || {}
    onUpdate({ ...account, monthData: { ...(account.monthData || {}), [prevDecMK]: { ...existing, balance: val } } })
  }

  // Guarda o "Colocado" do ano anterior — override de activePago no header.
  function savePrevYearPago(val) {
    const existing = account.monthData?.[prevDecMK] || {}
    onUpdate({ ...account, monthData: { ...(account.monthData || {}), [prevDecMK]: { ...existing, manualTotalPago: val } } })
  }

  function addContrib(contrib) {
    onUpdate({ ...account, contributions: [...contributions, contrib] })
    setAddingContrib(false)
  }

  function saveEditContrib(updated) {
    onUpdate({ ...account, contributions: contributions.map(c => c.id === updated.id ? updated : c) })
    setEditingContrib(null)
  }

  function removeContrib(id) {
    onUpdate({ ...account, contributions: contributions.filter(c => c.id !== id) })
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px' }}>
      {/* Linha principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <EditableField type="text" value={account.name} width={180} fontSize="0.85rem" onSave={name => onUpdate({ ...account, name })} />

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Saldo */}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', marginBottom: 1 }}>Saldo</span>
            <EditableField type="currency" value={balance || null} width={110} onSave={saveBalance} placeholder="Definir saldo" />
          </span>

          {/* Total pago (acumulado até ao mês) */}
          {activePago > 0 && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', marginBottom: 1 }}>Total pago</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {formatEuro(activePago)}
              </span>
            </span>
          )}

          {/* Toggle entregas */}
          <button onClick={() => { setShowContribs(!showContribs); setAddingContrib(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: showContribs ? 'var(--accent-dim)' : 'none', border: `1px solid ${showContribs ? 'rgba(129,140,248,0.3)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', color: showContribs ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.72rem', padding: '4px 8px', fontWeight: showContribs ? 600 : 400 }}
            onMouseEnter={e => { if (!showContribs) e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { if (!showContribs) e.currentTarget.style.color = 'var(--text-muted)' }}>
            <Gift size={12} />
            Entregas ({contributions.length})
            {showContribs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {/* Remover */}
          <button onClick={onRemove}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <Trash2 size={13} />
          </button>
        </span>
      </div>

      {/* Painel de entregas */}
      {showContribs && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>

          {/* Header do painel */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Histórico de movimentos
              </span>
              {thisYearActiveColocado > 0 && thisYearActiveColocado !== thisYearActivePago && (
                <span style={{ fontSize: '0.7rem', color: 'var(--yellow)' }}>
                  Encargos: {formatEuro(thisYearActivePago - thisYearActiveColocado)}
                </span>
              )}
            </div>
            {!addingContrib && (
              <button onClick={() => setAddingContrib(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--accent)', fontSize: '0.72rem', padding: '4px 10px', fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <Plus size={11} /> Registar movimento
              </button>
            )}
          </div>

          {/* Formulário novo */}
          {addingContrib && (
            <ContribForm currentMK={mk} onSave={addContrib} onCancel={() => setAddingContrib(false)} />
          )}

          {/* Lista de movimentos — grid único para alinhamento */}
          {(sortedContribs.length > 0 || hasPrevYearSummary) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '16px 110px 1fr 1fr 1fr minmax(0,120px) 44px', gap: '0 8px', alignItems: 'center' }}>
              {/* Cabeçalho */}
              <span />
              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>Data</span>
              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>Valor</span>
              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>No fundo</span>
              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>Encargos</span>
              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>Nota</span>
              <span />

              {/* Linha-resumo do ano anterior — só Janeiro */}
              {hasPrevYearSummary && <PrevYearSummaryRow mkYear={mkYear} prevYearPago={prevYearPago} prevYearBalance={prevYearBalance} onSavePago={savePrevYearPago} onSaveBalance={savePrevYearBalance} />}

              {sortedContribs.map(c => {
                if (editingContrib?.id === c.id) {
                  return (
                    <div key={c.id + '-edit'} style={{ gridColumn: '1 / -1', margin: '4px 0' }}>
                      <ContribForm currentMK={mk} initialValues={c}
                        onSave={saveEditContrib} onCancel={() => setEditingContrib(null)} />
                    </div>
                  )
                }

                const isFuture       = compareMK(c.mk, mk) > 0
                const isPendingMonth = !isFuture && !isContribActiveForMK(c, mk) // mesmo mês mas dia > 1
                const isLevantamento = (c.valorPago || 0) < 0
                const absPago     = Math.abs(c.valorPago     || 0)
                const absColocado = Math.abs(c.valorColocado || 0)
                const encargos    = isLevantamento ? 0 : (c.valorPago || 0) - (c.valorColocado || 0)
                const [cy, cm]    = c.mk.split('-').map(Number)
                const day         = c.day || 1
                const dimmed      = isFuture || isPendingMonth
                const rowBg  = dimmed ? 'var(--wa-02)' : isLevantamento ? 'rgba(239,68,68,0.04)' : 'rgba(129,140,248,0.04)'
                const rowBdr = dimmed ? 'transparent' : isLevantamento ? 'rgba(239,68,68,0.12)' : 'rgba(129,140,248,0.08)'
                const cellStyle  = { padding: '7px 0', opacity: dimmed ? 0.45 : 1, display: 'flex', alignItems: 'center' }
                const firstCell  = { ...cellStyle, paddingLeft: 8, borderRadius: '7px 0 0 7px', background: rowBg, border: `1px solid ${rowBdr}`, borderRight: 'none' }
                const midCell    = { ...cellStyle, background: rowBg, border: `1px solid ${rowBdr}`, borderLeft: 'none', borderRight: 'none' }
                // "No fundo" é a última célula do box — borda direita e canto arredondado.
                const boxLastCell = { ...cellStyle, paddingRight: 8, borderRadius: '0 7px 7px 0', background: rowBg, border: `1px solid ${rowBdr}`, borderLeft: 'none' }
                // Encargos, Nota e Ações ficam fora do box — sem borda.
                const plainCell  = { ...cellStyle }
                return (
                  <>
                    {/* Indicador tipo */}
                    <span key={c.id + '-t'} style={{ ...firstCell, justifyContent: 'center' }}>
                      <ArrowDownUp size={10} style={{ color: isLevantamento ? 'var(--red)' : 'var(--accent)', transform: isLevantamento ? 'none' : 'scaleY(-1)' }} />
                    </span>
                    {/* Data (dia + mês + ano) */}
                    <span key={c.id + '-m'} style={{ ...midCell, fontSize: '0.7rem', color: isLevantamento ? 'var(--red)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', gap: 4 }}>
                      <span style={{ whiteSpace: 'nowrap' }}>{day} {MONTHS_SHORT[cm]} {cy}</span>
                      {isFuture && <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>futuro</span>}
                      {isPendingMonth && <span style={{ fontSize: '0.58rem', color: 'var(--yellow)', background: 'rgba(251,191,36,0.1)', padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>próx.</span>}
                    </span>
                    {/* Valor */}
                    <span key={c.id + '-p'} style={{ ...midCell, fontSize: '0.85rem', fontWeight: 700, color: isLevantamento ? 'var(--red)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                      {isLevantamento ? '−' : ''}{formatEuro(absPago)}
                    </span>
                    {/* No fundo — fim do box */}
                    <span key={c.id + '-c'} style={{ ...boxLastCell, fontSize: '0.85rem', fontWeight: 700, color: isLevantamento ? 'var(--red)' : 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                      {isLevantamento ? '−' : ''}{formatEuro(absColocado)}
                    </span>
                    {/* Encargos — fora do box */}
                    <span key={c.id + '-e'} style={{ ...plainCell, fontSize: '0.78rem', fontWeight: 600, color: 'var(--yellow)', fontVariantNumeric: 'tabular-nums' }}>
                      {encargos > 0 ? formatEuro(encargos) : ''}
                    </span>
                    {/* Nota — fora do box */}
                    <span key={c.id + '-n'} style={{ ...plainCell, fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.note || ''}
                    </span>
                    {/* Editar + Apagar */}
                    <span key={c.id + '-a'} style={{ ...plainCell, justifyContent: 'flex-end', gap: 2 }}>
                      <button onClick={() => { setEditingContrib(c); setAddingContrib(false) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <Pencil size={10} />
                      </button>
                      <button onClick={() => removeContrib(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <Trash2 size={10} />
                      </button>
                    </span>
                  </>
                )
              })}

              {/* Linha de totais — só contribuições do ano actual */}
              {sortedContribs.length > 0 && <>
                <span style={{ gridColumn: '1 / 3', padding: '8px 8px 4px', borderTop: '1px solid var(--border)', marginTop: 4, fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Total {mkYear}
                </span>
                <span style={{ padding: '8px 0 4px', borderTop: '1px solid var(--border)', marginTop: 4, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(thisYearActivePago)}</span>
                <span style={{ padding: '8px 0 4px', borderTop: '1px solid var(--border)', marginTop: 4, fontSize: '0.82rem', fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(thisYearActiveColocado)}</span>
                <span style={{ padding: '8px 0 4px', borderTop: '1px solid var(--border)', marginTop: 4, fontSize: '0.78rem', fontWeight: 700, color: thisYearActivePago - thisYearActiveColocado > 0 ? 'var(--yellow)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {thisYearActivePago - thisYearActiveColocado > 0 ? formatEuro(thisYearActivePago - thisYearActiveColocado) : ''}
                </span>
                <span style={{ gridColumn: '6 / 8', borderTop: '1px solid var(--border)', marginTop: 4 }} />
              </>}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '16px 0' }}>
              Ainda sem movimentos registados.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
