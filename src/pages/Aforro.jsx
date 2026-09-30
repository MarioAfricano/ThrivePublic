import { useState, useEffect } from 'react'
import { Plus, RefreshCw, AlertCircle, Landmark } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { formatEuro, getMK } from '../data/initialData.js'
import {
  AFORRO_TIERS as TIERS,
  getAforroTier as getTier,
} from '../utils/calc/savingsCalc.js'
import EditRate from '../components/aforro/EditRate.jsx'
import CertCard from '../components/aforro/CertCard.jsx'
import AddForm from '../components/aforro/AddForm.jsx'
import PaymentsTimeline from '../components/aforro/PaymentsTimeline.jsx'
import { monthsElapsed, calcValue, fetchEuribor3M } from '../components/aforro/utils.js'

// ══════════════════════════════════════════════════════════════════
//  PÁGINA — Certificados de Aforro
// ══════════════════════════════════════════════════════════════════
// Orquestração: busca Euribor 3M do BCE (auto no mount),
// CRUD de certificados e cálculo de totais/médias/próximo escalão.
// Componentes visuais em `src/components/aforro/`.
//
// Modelo de dados em `data.aforro`:
//   { euribor, euriborUpdated, certificates: [{ id, date, amount,
//     rateHistory: { "0": 0.02, "3": 0.025, ... }, valueOverride,
//     notes }] }
// rateHistory usa período em meses como chave (0 = mês 1–3, 3 = 4–6…).
export default function Aforro() {
  const { data, saveData } = useApp()
  const [adding, setAdding]         = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  const aforro         = data?.aforro || {}
  const euribor        = aforro.euribor || 0
  const euriborUpdated = aforro.euriborUpdated || null
  const certificates   = aforro.certificates || []

  function saveAforro(updates) {
    saveData({ aforro: { ...aforro, ...updates } })
  }

  // Auto-preenche taxas de períodos completos que ainda não têm
  // override guardado — usa a taxa actual (razoável como default).
  function autoFillPeriods(certs, rate) {
    return certs.map(cert => {
      const months = monthsElapsed(cert.date)
      const completedPeriods = Array.from({ length: Math.floor(months / 3) }, (_, i) => i * 3)
      const rh = { ...(cert.rateHistory || {}) }
      for (const ps of completedPeriods) {
        if (rh[ps] == null) rh[ps] = rate
      }
      return { ...cert, rateHistory: rh }
    })
  }

  // Fetch Euribor ao montar a página.
  useEffect(() => {
    handleRefresh()
  }, []) // eslint-disable-line

  async function handleRefresh() {
    setRefreshing(true)
    setFetchError(false)
    try {
      const rate = await fetchEuribor3M()
      const now  = new Date()
      const mk   = getMK(now.getFullYear(), now.getMonth())
      const updatedCerts = autoFillPeriods(certificates, rate)
      saveAforro({ euribor: rate, euriborUpdated: mk, certificates: updatedCerts })
    } catch {
      setFetchError(true)
    }
    setRefreshing(false)
  }

  // ── CRUD certificados ─────────────────────────────────────────
  function addCert(cert) {
    const filled = autoFillPeriods([cert], euribor)[0]
    saveAforro({ certificates: [...certificates, filled] })
    setAdding(false)
  }
  function updateCert(updated) {
    saveAforro({ certificates: certificates.map(c => c.id === updated.id ? updated : c) })
  }
  function removeCert(id) {
    saveAforro({ certificates: certificates.filter(c => c.id !== id) })
  }

  // ── Totais ───────────────────────────────────────────────────
  const totalInvested = certificates.reduce((s, c) => s + c.amount, 0)
  const totalValue    = certificates.reduce((s, c) => s + calcValue(c, euribor), 0)
  const totalProfit   = totalValue - totalInvested

  // Taxa média ponderada pelo montante investido.
  const avgRate = totalInvested > 0
    ? certificates.reduce((s, c) => {
        const m = monthsElapsed(c.date)
        return s + (euribor + getTier(m).bonus) * c.amount
      }, 0) / totalInvested
    : 0

  // Próximo escalão a atingir (o mais próximo entre todos os certificados).
  const nextMilestone = certificates
    .map(c => {
      const m = monthsElapsed(c.date)
      const next = TIERS.find(x => x.min > m)
      return next ? { cert: c, monthsLeft: next.min - m, nextLabel: next.label, nextBonus: next.bonus } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.monthsLeft - b.monthsLeft)[0]

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Título ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#2dd4bf,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Landmark size={20} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>Certificados de Aforro</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Juros calculados automaticamente · taxa actualizada com Euribor 3M
          </p>
        </div>
        <button onClick={() => setAdding(true)} disabled={adding}
          style={{ background: 'linear-gradient(135deg,#2dd4bf,#34d399)', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 18px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, opacity: adding ? 0.5 : 1 }}>
          <Plus size={14} /> Novo certificado
        </button>
      </div>

      {/* ── Euribor + resumo ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'stretch' }}>

        {/* Euribor card */}
        <div style={{ ...card, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Euribor 3M
            </p>
            <button onClick={handleRefresh} disabled={refreshing} title="Actualizar Euribor"
              style={{ background: 'none', border: 'none', cursor: refreshing ? 'default' : 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              onMouseEnter={e => { if (!refreshing) e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>

          {euribor > 0 ? (
            <>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {(euribor * 100).toFixed(3)}%
              </p>
              {euriborUpdated && (
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  Actualizado em {euriborUpdated}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {refreshing ? 'A carregar…' : 'Não disponível'}
            </p>
          )}

          {fetchError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', padding: '4px 8px', borderRadius: 5, marginTop: 2 }}>
              <AlertCircle size={11} /> Sem acesso à API do BCE.
            </div>
          )}

          {/* Edição manual da taxa */}
          <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 4 }}>Editar manualmente:</p>
            <EditRate
              rate={euribor || 0}
              onSave={r => saveAforro({ euribor: r })}
              onClear={null}
            />
            <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {(euribor * 100).toFixed(3)}%
            </span>
          </div>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Total Investido</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatEuro(totalInvested)}</div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Valor Actual</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatEuro(totalValue)}</div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Juros Totais</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: totalProfit >= 0 ? 'var(--green)' : '#ef4444', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {totalProfit >= 0 ? '+' : ''}{formatEuro(totalProfit)}
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Taxa Média</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: '#2dd4bf', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {(avgRate * 100).toFixed(3)}%
            </div>
          </div>
          {nextMilestone && (
            <div style={{ background: `${getTier(monthsElapsed(nextMilestone.cert.date) + 1).color}10`, border: `1px solid ${getTier(monthsElapsed(nextMilestone.cert.date) + 1).color}30`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>Próximo Escalão</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {nextMilestone.nextLabel} daqui a <strong style={{ color: '#818cf8' }}>{nextMilestone.monthsLeft}m</strong>
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4, opacity: 0.8 }}>
                +{(nextMilestone.nextBonus * 100).toFixed(2)}% bónus
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Timeline de próximos pagamentos ──────────────────────── */}
      {certificates.length > 0 && (
        <PaymentsTimeline certificates={certificates} euribor={euribor} />
      )}

      {/* ── Formulário de adição ────────────────────────────────── */}
      {adding && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: '#60a5fa' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Novo certificado</span>
          </div>
          <AddForm onAdd={addCert} euribor={euribor} onClose={() => setAdding(false)} />
        </div>
      )}

      {/* ── Lista de certificados ───────────────────────────────── */}
      {certificates.length === 0 && !adding ? (
        <div style={{ border: '2px dashed rgba(45,212,191,0.25)', borderRadius: 16, padding: '64px 32px', textAlign: 'center' }}>
          <Landmark size={52} style={{ color: 'rgba(45,212,191,0.25)', display: 'block', margin: '0 auto 14px' }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Sem certificados</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Adiciona o teu primeiro Certificado de Aforro para calcular os juros automaticamente.
          </p>
          <button onClick={() => setAdding(true)}
            style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.35)', borderRadius: 10, color: '#2dd4bf', cursor: 'pointer', padding: '10px 22px', fontSize: '0.875rem', fontWeight: 600 }}>
            + Adicionar primeiro certificado
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...certificates].sort((a, b) => new Date(a.date) - new Date(b.date)).map(cert => (
            <CertCard
              key={cert.id}
              cert={cert}
              euribor={euribor}
              onUpdate={updateCert}
              onRemove={removeCert}
            />
          ))}
        </div>
      )}
    </div>
  )
}
