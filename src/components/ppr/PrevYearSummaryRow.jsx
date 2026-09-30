import { PiggyBank } from 'lucide-react'
import { EditableField } from '../ui/EditableField.jsx'

// ── Linha dourada de resumo do ano anterior (só Janeiro) ─────────
// Dois campos editáveis: "Colocado" (override de total pago) e
// "Saldo" (saldo no fundo a 31/Dez). Ao editar estes campos, o
// header do account reflecte os totais imediatamente.
// Render como múltiplos spans para encaixar no grid do PPRAccountRow.
export default function PrevYearSummaryRow({ mkYear, prevYearPago, prevYearBalance, onSavePago, onSaveBalance }) {
  const sBg   = 'rgba(251,191,36,0.05)'
  const sBdr  = '1px solid rgba(251,191,36,0.18)'
  const sBase = { display: 'flex', alignItems: 'center', padding: '7px 0' }
  return (
    <>
      <span style={{ ...sBase, paddingLeft: 8, borderRadius: '7px 0 0 7px', background: sBg, border: sBdr, borderRight: 'none', justifyContent: 'center' }}>
        <PiggyBank size={10} style={{ color: 'var(--yellow)' }} />
      </span>
      <span style={{ ...sBase, background: sBg, border: sBdr, borderLeft: 'none', borderRight: 'none', fontSize: '0.7rem', color: 'var(--yellow)', fontWeight: 600 }}>
        <span style={{ whiteSpace: 'nowrap' }}>Resumo {mkYear - 1}</span>
      </span>
      {/* Colocado — override de "Total pago" no header */}
      <span style={{ ...sBase, background: sBg, border: sBdr, borderLeft: 'none', borderRight: 'none' }}>
        <EditableField type="currency" value={prevYearPago || null} width={110} onSave={onSavePago} placeholder="Colocado" />
      </span>
      {/* Saldo — independente de "Colocado" */}
      <span style={{ ...sBase, paddingRight: 8, borderRadius: '0 7px 7px 0', background: sBg, border: sBdr, borderLeft: 'none' }}>
        <EditableField type="currency" value={prevYearBalance || null} width={110} onSave={onSaveBalance} placeholder="Saldo" />
      </span>
      <span /><span /><span />
    </>
  )
}
