import { useState } from 'react'
import { Plus, PiggyBank } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  formatEuro, getMK, MONTHS,
  calcPPRTotal, calcPPRContribTotals, isPPRPlatformVisible,
} from '../data/initialData.js'
import PPRMonthHeader from '../components/ppr/PPRMonthHeader.jsx'
import TaxBenefitCard from '../components/ppr/TaxBenefitCard.jsx'
import PPRSharedChart from '../components/ppr/PPRSharedChart.jsx'
import PPRPlatformCard from '../components/ppr/PPRPlatformCard.jsx'
import NewPlatformModal from '../components/ppr/NewPlatformModal.jsx'

// ══════════════════════════════════════════════════════════════════
//  PÁGINA — PPR (Plano Poupança Reforma)
// ══════════════════════════════════════════════════════════════════
// Orquestra seleção de mês, CRUD de plataformas e cálculo de totais
// (saldo, total pago, lucro). Componentes em `src/components/ppr/`.
//
// Modelo de dados em `data.ppr`:
//   { platforms: [{ id, name, color, accounts: [{ id, name,
//       contributions: [{ id, mk, day, valorPago, valorColocado, note }],
//       monthData: { "YYYY-M": { balance, manualTotalPago } },
//       startMK, deletedFromMK }], startMK, deletedFromMK }],
//     months: { "YYYY-M": true } }
//
// `data.currentYear` / `data.currentMonth` controlam o mês visível.
export default function PPR() {
  const { data, saveData } = useApp()
  const [showModal, setShowModal] = useState(false)

  const year  = data?.currentYear  ?? new Date().getFullYear()
  const month = data?.currentMonth ?? new Date().getMonth()
  const mk    = getMK(year, month)

  const pprData        = data?.ppr || {}
  const platforms      = pprData.platforms || []
  const visiblePlatforms = platforms.filter(p => isPPRPlatformVisible(p, mk))

  const totalBalance = calcPPRTotal(visiblePlatforms, mk)
  const { pago, colocado, encargos, countEntregas, countLevantamentos } = calcPPRContribTotals(visiblePlatforms, mk)

  // Lucro: saldo − total pago (lucro real, inclui penalização por encargos).
  // Lucro PPR: saldo − total colocado (ganho dentro do fundo).
  const lucroPago     = totalBalance - pago
  const lucroColocado = totalBalance - colocado

  function updatePlatform(updated) {
    saveData({ ppr: { ...pprData, platforms: platforms.map(p => p.id === updated.id ? updated : p) } })
  }
  function setBirthYear(birthYear) {
    saveData({ profile: { ...(data?.profile || {}), birthYear } })
  }
  function addPlatform(p) {
    saveData({ ppr: { ...pprData, platforms: [...platforms, p] } })
  }
  function removePlatform(id) {
    // Soft-delete: plataforma fica nos dados históricos, só deixa
    // de aparecer a partir deste mês.
    saveData({ ppr: { ...pprData, platforms: platforms.map(p => p.id === id ? { ...p, deletedFromMK: mk } : p) } })
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#a78bfa,#f472b6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PiggyBank size={20} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>PPR</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Plano Poupança Reforma · {MONTHS[month]} {year}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ background: 'linear-gradient(135deg,#a78bfa,#818cf8)', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 18px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Nova plataforma
        </button>
      </div>

      {/* Navegação de mês */}
      {data && <PPRMonthHeader data={data} saveData={saveData} platforms={visiblePlatforms} />}

      {/* Benefício fiscal (usa todas as plataformas — contribuições do ano
          contam mesmo que a plataforma tenha sido entretanto removida) */}
      <TaxBenefitCard
        platforms={platforms}
        year={year}
        birthYear={data?.profile?.birthYear}
        onSetBirthYear={setBirthYear}
      />

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>

        {/* Saldo */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Saldo Total</div>
          <div style={{ fontSize: '1.32rem', fontWeight: 800, color: '#f472b6', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatEuro(totalBalance)}</div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4, opacity: 0.8 }}>{MONTHS[month]} {year}</div>
        </div>

        {/* Entregas */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Total Pago</div>
          <div style={{ fontSize: '1.32rem', fontWeight: 800, color: '#818cf8', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatEuro(pago)}</div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4, opacity: 0.8 }}>
            {countEntregas > 0 && <>{countEntregas} entrega{countEntregas !== 1 ? 's' : ''}</>}
            {countEntregas > 0 && countLevantamentos > 0 && ' · '}
            {countLevantamentos > 0 && <span style={{ color: 'var(--red)' }}>{countLevantamentos} levantamento{countLevantamentos !== 1 ? 's' : ''}</span>}
            {encargos > 0 && <span style={{ color: 'var(--yellow)' }}> · Encargos: {formatEuro(encargos)}</span>}
          </div>
        </div>

        {/* Lucro */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Lucro / Perda</div>
          <div style={{ fontSize: '1.32rem', fontWeight: 800, color: lucroPago >= 0 ? 'var(--green)' : '#ef4444', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {lucroPago >= 0 ? '+' : ''}{formatEuro(lucroPago)}
          </div>
          <div style={{ fontSize: '0.73rem', color: lucroPago >= 0 ? 'var(--green)' : '#ef4444', marginTop: 4, opacity: 0.8 }}>
            Saldo − total pago
            {encargos > 0 && <> · PPR: {lucroColocado >= 0 ? '+' : ''}{formatEuro(lucroColocado)}</>}
          </div>
        </div>
      </div>

      {/* Gráfico partilhado (só aparece com 2+ plataformas) */}
      <PPRSharedChart platforms={visiblePlatforms} mk={mk} />

      {/* Plataformas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visiblePlatforms.map(platform => (
          <PPRPlatformCard key={platform.id} platform={platform} mk={mk}
            onUpdate={updatePlatform} onRemove={() => removePlatform(platform.id)} />
        ))}
        {visiblePlatforms.length === 0 && (
          <div style={{ border: '2px dashed rgba(167,139,250,0.25)', borderRadius: 16, padding: '64px 32px', textAlign: 'center' }}>
            <PiggyBank size={52} style={{ color: 'rgba(167,139,250,0.25)', display: 'block', margin: '0 auto 14px' }} />
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Sem plataformas PPR</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Adiciona uma plataforma (Allianz, Fidelidade, Caixa…) para registar o teu PPR.
            </p>
            <button onClick={() => setShowModal(true)} style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 10, color: '#a78bfa', cursor: 'pointer', padding: '10px 22px', fontSize: '0.875rem', fontWeight: 600 }}>
              + Adicionar primeira plataforma
            </button>
          </div>
        )}
      </div>

      {showModal && <NewPlatformModal onAdd={addPlatform} onClose={() => setShowModal(false)} mk={mk} />}
    </div>
  )
}
