import { useState } from 'react'
import { Plus, RefreshCw, Building2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  formatEuro, getMK, getAccData,
  calcSavingsTotal, calcBancoTotal,
  isAccVisible,
} from '../data/initialData.js'
import PlatformCard from '../components/banks/PlatformCard.jsx'
import NewPlatformModal from '../components/banks/NewPlatformModal.jsx'
import BanksMonthHeader from '../components/banks/BanksMonthHeader.jsx'
import ConfirmBtn from '../components/banks/ConfirmBtn.jsx'
import { ACCOUNT_TYPES } from '../components/banks/constants.js'

// ── Página Bancos — orquestração ──────────────────────────────
// Esta página é puro shell: resolve o mês activo, agrega totais, e
// delega o render aos componentes de `src/components/banks/`.
//
// Responsabilidades que ficam aqui:
//   - hooks (`useApp`) e derivação do mês actual (`mk`)
//   - handlers de update/add/remove da lista de plataformas
//   - drag-and-drop das plataformas (inter-card; o DnD intra-card das
//     contas vive dentro do PlatformCard)
//   - cálculo do 4º card (juros do ano com separação bruto / retido /
//     líquido), que depende de múltiplas plataformas em simultâneo
//   - layout da página e modais de 1º nível
export default function Banks() {
  const { data, saveData, exchangeRates } = useApp()
  const [showModal,     setShowModal]     = useState(false)
  const [dragPlatIdx,   setDragPlatIdx]   = useState(null)
  const [overPlatIdx,   setOverPlatIdx]   = useState(null)

  const year  = data?.currentYear  ?? new Date().getFullYear()
  const month = data?.currentMonth ?? new Date().getMonth()
  const mk    = getMK(year, month)

  const banks              = data?.banks || {}
  const { platforms = [] } = banks
  const lockedMonths       = data?.years?.[year]?.lockedMonths || []
  const isLocked           = lockedMonths.includes(month)
  const visiblePlatforms   = platforms.filter(p => isAccVisible(p, mk))

  // Platforms stay in place during drag — only highlight target (no flickering)
  const displayPlatforms = visiblePlatforms

  function applyPlatformDragReorder(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const arr = [...visiblePlatforms]
    const [item] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, item)
    const visIds = arr.map(p => p.id)
    const others = platforms.filter(p => !visIds.includes(p.id))
    saveData({ banks: { ...banks, platforms: [...visIds.map(id => platforms.find(p => p.id === id)), ...others] } })
  }

  const totalPoupanca = calcSavingsTotal(visiblePlatforms, mk, exchangeRates)
  const totalBanco    = calcBancoTotal(visiblePlatforms, mk, exchangeRates)

  // ── Cálculo de juros (para o 4º card) ─────────────────────────
  // Fórmula: acumula juros líquidos de poupanças normais (+IRS 28% a
  // declarar) e de poupanças com desconto (IRS já retido na fonte).
  // Se houver dados em Dez do ano anterior, reporta só o delta do ano
  // corrente ("este ano"), senão reporta tudo acumulado.
  const prevDecMK = getMK(year - 1, 11)
  let grossPoupanca = 0, grossPoupancaPrev = 0
  let withheldTax = 0, withheldTaxPrev = 0
  let netPD = 0, netPDPrev = 0
  for (const p of platforms) {
    for (const a of p.accounts) {
      if (!isAccVisible(a, mk)) continue
      const d      = getAccData(a, mk)
      const dPrev  = getAccData(a, prevDecMK)
      const fx     = d.rateToEUR ?? 1.0
      const fxP    = dPrev.rateToEUR ?? fx
      if (a.type === 'poupanca') {
        grossPoupanca     += (d.interest     || 0) * fx
        grossPoupancaPrev += (dPrev.interest || 0) * fxP
      } else if (a.type === 'poupanca_desconto') {
        const tax   = a.taxRate ?? 0.28
        netPD       += (d.interest     || 0) * fx
        netPDPrev   += (dPrev.interest || 0) * fxP
        withheldTax     += ((d.interest     || 0) * fx)  / (1 - tax) * tax
        withheldTaxPrev += ((dPrev.interest || 0) * fxP) / (1 - tax) * tax
      }
    }
  }
  const hasPrevData    = grossPoupancaPrev > 0 || withheldTaxPrev > 0
  const grossThisYear  = grossPoupanca - grossPoupancaPrev
  const taxToDeclare   = grossThisYear * 0.28
  const withheldThisYear = withheldTax - withheldTaxPrev
  const netPDThisYear  = netPD - netPDPrev
  const totalNet       = grossThisYear - taxToDeclare + (hasPrevData ? netPDThisYear : netPD)
  const hasInterest    = grossPoupanca > 0 || netPD > 0

  function resetMonthInterest() {
    const updated = platforms.map(p => ({
      ...p,
      accounts: p.accounts.map(a => {
        if (a.type === 'conta') return a
        const d = getAccData(a, mk)
        return { ...a, interest: 0, monthData: { ...(a.monthData || {}), [mk]: { ...d, interest: 0 } } }
      }),
    }))
    saveData({ banks: { ...banks, platforms: updated } })
  }
  function resetInterestHistory() {
    const updated = platforms.map(p => ({
      ...p,
      accounts: p.accounts.map(a => {
        if (a.type !== 'poupanca_desconto') return a
        const d = getAccData(a, mk)
        return { ...a, interestHistory: [], monthData: { ...(a.monthData || {}), [mk]: { ...d, interestHistory: [] } } }
      }),
    }))
    saveData({ banks: { ...banks, platforms: updated } })
  }

  function updatePlatform(updated) {
    saveData({ banks: { ...banks, platforms: platforms.map(p => p.id === updated.id ? updated : p) } })
  }
  function addPlatform(p) {
    saveData({ banks: { ...banks, platforms: [...platforms, p] } })
  }
  function removePlatform(id) {
    // Soft-delete: plataforma fica nos dados históricos, só desaparece a partir deste mês
    saveData({ banks: { ...banks, platforms: platforms.map(p => p.id === id ? { ...p, deletedFromMK: mk } : p) } })
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>
              Bancos & Poupança
              {isLocked && <span style={{ marginLeft: 10, fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600, letterSpacing: 0 }}>Mês fechado</span>}
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {isLocked ? 'Mês bloqueado — clica em "Desbloquear" para editar' : 'Clica em qualquer valor para editar'}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} disabled={isLocked}
          style={{ background: isLocked ? 'var(--bg-elevated)' : 'linear-gradient(135deg,#60a5fa,#3b82f6)', border: isLocked ? '1px solid var(--border)' : 'none', borderRadius: 10, color: isLocked ? 'var(--text-muted)' : '#fff', padding: '10px 18px', cursor: isLocked ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, opacity: isLocked ? 0.5 : 1 }}>
          <Plus size={14} /> Nova plataforma
        </button>
      </div>

      {/* Navegação de meses */}
      {data && <BanksMonthHeader data={data} saveData={saveData} platforms={platforms} />}

      {/* Resumo — 3 cards base + 4º de juros se existirem */}
      <div style={{ display: 'grid', gridTemplateColumns: hasInterest ? 'repeat(4,1fr)' : 'repeat(3,1fr)', gap: 14 }}>
        {[
          { label: 'Total Poupanças', value: totalPoupanca, sub: 'Contas poupança e investimento', color: '#60a5fa' },
          { label: 'Total Banco',      value: totalBanco,   sub: 'Contas à ordem', color: 'var(--text)' },
          { label: 'Total Geral',      value: totalPoupanca + totalBanco, sub: 'Banco + Poupanças', color: 'var(--text)' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatEuro(value)}</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4, opacity: 0.8 }}>{sub}</div>
          </div>
        ))}

        {/* 4º card: juros */}
        {hasInterest && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Juros · {year}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <ConfirmBtn label="↺" title="Reset juros" onConfirm={resetMonthInterest} icon={RefreshCw} />
                {netPD > 0 && <ConfirmBtn label="↺₂" title="Reset histórico" onConfirm={resetInterestHistory} icon={RefreshCw} />}
              </div>
            </div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--accent)', lineHeight: 1, marginBottom: 8 }}>
              {formatEuro(hasPrevData ? grossThisYear : grossPoupanca)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {taxToDeclare > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>IRS a declarar (28%)</span>
                  <span style={{ fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums', color: 'var(--red)', fontWeight: 600 }}>−{formatEuro(taxToDeclare)}</span>
                </div>
              )}
              {(hasPrevData ? withheldThisYear : withheldTax) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>IRS retido na fonte</span>
                  <span style={{ fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums', color: 'var(--yellow)', fontWeight: 600 }}>−{formatEuro(hasPrevData ? withheldThisYear : withheldTax)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 2 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Líquido</span>
                <span style={{ fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums', color: totalNet >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{formatEuro(totalNet)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legenda tipos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tipos de conta:</span>
        {Object.entries(ACCOUNT_TYPES).map(([key, t]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color }} />
            <strong style={{ color: t.color }}>{t.label}</strong> — {t.desc}
          </span>
        ))}
      </div>

      {/* Plataformas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {displayPlatforms.map((platform, idx) => (
          <div key={platform.id}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overPlatIdx !== idx) setOverPlatIdx(idx) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverPlatIdx(null) }}
            onDrop={e => { e.preventDefault(); applyPlatformDragReorder(dragPlatIdx, idx); setDragPlatIdx(null); setOverPlatIdx(null) }}
            onDragEnd={() => { setDragPlatIdx(null); setOverPlatIdx(null) }}>
            <PlatformCard platform={platform} mk={mk} locked={isLocked}
              onUpdate={updatePlatform} onRemove={() => removePlatform(platform.id)}
              isDragOver={overPlatIdx === idx && dragPlatIdx !== idx}
              dragHandleProps={{ draggable: true, onDragStart: e => { e.dataTransfer.effectAllowed = 'move'; setDragPlatIdx(idx) } }}
            />
          </div>
        ))}
        {visiblePlatforms.length === 0 && (
          <div style={{ border: '2px dashed rgba(96,165,250,0.25)', borderRadius: 16, padding: '64px 32px', textAlign: 'center' }}>
            <Building2 size={52} style={{ color: 'rgba(96,165,250,0.25)', display: 'block', margin: '0 auto 14px' }} />
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Sem plataformas</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Adiciona um banco (CGD, BPI, Montepio…) para gerir as tuas contas e poupanças.
            </p>
            <button onClick={() => setShowModal(true)} style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: 10, color: '#60a5fa', cursor: 'pointer', padding: '10px 22px', fontSize: '0.875rem', fontWeight: 600 }}>
              + Adicionar primeiro banco
            </button>
          </div>
        )}
      </div>

      {showModal && <NewPlatformModal onAdd={addPlatform} onClose={() => setShowModal(false)} mk={mk} />}
    </div>
  )
}
