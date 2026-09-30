import { useState } from 'react'
import { Plus, Bitcoin, AlertCircle, RefreshCw, Shield } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { formatEuro, getMK } from '../data/initialData.js'
import { generateId as uid } from '../utils/id.js'
import {
  holdingGastoAtMk, holdingValueAtMk, holdingTaxBreakdown,
} from '../utils/calc/cryptoCalc.js'
import CryptoMonthHeader from '../components/crypto/CryptoMonthHeader.jsx'
import { buildLockMonthPatch, buildUnlockMonthPatch } from '../utils/lockMonth.js'
import PlatformCard from '../components/crypto/PlatformCard.jsx'
import AddPlatformModal from '../components/crypto/AddPlatformModal.jsx'
import { profitColor } from '../components/crypto/utils.js'

// ── Página Crypto (orquestração) ──────────────────────────────────
// Navegação ano/mês independente do dashboard (usa sempre o "now" real).
// Fechar mês congela `h.price` em `h.monthData[mk].price` para cada
// holding e fecha também bancos e ações (lock unificado). Abrir mês só
// remove das `lockedMonths` (nos três sistemas) — os preços congelados
// permanecem e voltam a ser usados se o mês for fechado outra vez.
export default function Crypto() {
  const { data, saveData, fetchCryptoPrices, cryptoPricesLoading } = useApp()
  const cryptoData = (data?.crypto && typeof data.crypto === 'object') ? data.crypto : {}
  // Suporte dos dois formatos (legado sem `platforms` e actual).
  const platforms  = Array.isArray(cryptoData.platforms) ? cryptoData.platforms : []
  const [showAddPlatform, setShowAddPlatform] = useState(false)

  // ── Navegação de mês ──────────────────────────────────────────
  // null = usa o valor real. Mês/ano real são calculados uma vez.
  const realNow0   = new Date()
  const realYear0  = realNow0.getFullYear()
  const realMonth0 = realNow0.getMonth()
  const [viewYear,  setViewYear]  = useState(null)
  const [viewMonth, setViewMonth] = useState(null)
  const year  = viewYear  ?? realYear0
  const month = viewMonth ?? realMonth0
  const mk    = getMK(year, month)
  const cryptoYears  = cryptoData.years || {}
  const lockedMonths = cryptoYears[year]?.lockedMonths || []
  const isLocked     = lockedMonths.includes(month)

  // ── Fechar / Abrir mês (unificado: bancos + ações + cripto) ───
  // buildLockMonthPatch congela o preço em monthData[mk] (preserva um
  // snapshot já existente) e fecha os três sistemas de lock de uma vez.
  function closeMonth() {
    const patch = buildLockMonthPatch(data, year, month)
    if (Object.keys(patch).length) saveData(patch)
  }

  function openMonth() {
    const patch = buildUnlockMonthPatch(data, year, month)
    if (Object.keys(patch).length) saveData(patch)
  }

  function handleViewYear(y) {
    const newY = Math.max(2020, Math.min(y, realYear0))
    setViewYear(newY === realYear0 ? null : newY)
    setViewMonth(null)
  }
  function handleViewMonth(m) {
    setViewMonth(m === realMonth0 && (viewYear == null || viewYear === realYear0) ? null : m)
  }

  // ── Agregados globais ─────────────────────────────────────────
  const allHoldings   = platforms.flatMap(p => Array.isArray(p.holdings) ? p.holdings : [])
  const totalValue    = allHoldings.reduce((s, h) => s + holdingValueAtMk(h, mk), 0)
  const totalGasto    = allHoldings.reduce((s, h) => s + holdingGastoAtMk(h, mk), 0)
  const totalProfit   = totalValue - totalGasto
  const profitPct     = totalGasto > 0 ? totalProfit / totalGasto : 0
  const totalRealized = allHoldings.reduce((s, h) => s + (h.realizedProfit || 0), 0)
  const bds           = allHoldings.map(holdingTaxBreakdown)
  const totalIRS      = bds.reduce((s, b) => s + b.taxDue, 0)
  const exemptValue   = bds.reduce((s, b) => s + b.exemptValue, 0)

  // ── Mutações ──────────────────────────────────────────────────
  function save(newCrypto) { saveData({ crypto: newCrypto }) }
  const upd = (fn) => save({ ...cryptoData, platforms: fn(platforms) })

  const addPlatform    = (name)       => upd(ps => [...ps, { id: uid(), name, holdings: [] }])
  const renamePlatform = (id, n)      => upd(ps => ps.map(p => p.id === id ? { ...p, name: n } : p))
  const deletePlatform = (id)         => upd(ps => ps.filter(p => p.id !== id))
  const addHolding     = (pid, h)     => upd(ps => ps.map(p => p.id === pid ? { ...p, holdings: [...p.holdings, { ...h, id: uid() }] } : p))
  const updateHolding  = (pid, hid, u) => upd(ps => ps.map(p => p.id === pid ? { ...p, holdings: p.holdings.map(h => h.id === hid ? { ...h, ...u } : h) } : p))
  const deleteHolding  = (pid, hid)   => upd(ps => ps.map(p => p.id === pid ? { ...p, holdings: p.holdings.filter(h => h.id !== hid) } : p))
  const addLot         = (pid, hid, l) => upd(ps => ps.map(p => p.id === pid ? { ...p, holdings: p.holdings.map(h => h.id === hid ? { ...h, lots: [...(h.lots || []), { ...l, id: uid() }] } : h) } : p))
  const deleteLot      = (pid, hid, lid) => upd(ps => ps.map(p => p.id === pid ? { ...p, holdings: p.holdings.map(h => h.id === hid ? { ...h, lots: (h.lots || []).filter(l => l.id !== lid) } : h) } : p))

  // ── KPI cards (pre-calculados) ────────────────────────────────
  const kpiCards = [
    { label: 'Valor Total', val: formatEuro(totalValue), sub: null, color: 'var(--text)' },
    { label: 'Investido',   val: formatEuro(totalGasto), sub: null, color: 'var(--text-secondary)' },
    {
      label: 'Lucro não realizado',
      val: `${totalProfit >= 0 ? '+' : ''}${formatEuro(totalProfit)}`,
      sub: `${totalProfit >= 0 ? '+' : ''}${(profitPct * 100).toFixed(1)}%`,
      color: profitColor(totalProfit),
    },
    ...(totalRealized !== 0 ? [{
      label: 'Lucro realizado (vendas)',
      val: `${totalRealized >= 0 ? '+' : ''}${formatEuro(totalRealized)}`,
      sub: null,
      color: profitColor(totalRealized),
    }] : []),
    {
      label: 'IRS Estimado',
      val: totalIRS > 0 ? formatEuro(totalIRS) : 'Isento',
      sub: totalIRS > 0 ? '28% sobre ganhos < 1 ano' : allHoldings.length > 0 ? 'Tudo isento! 🎉' : '—',
      color: totalIRS > 0 ? '#fbbf24' : allHoldings.length > 0 ? 'var(--green)' : 'var(--text-muted)',
    },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#f59e0b,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bitcoin size={20} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>Criptomoeda</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Isenção total de IRS após 1 ano · 28% sobre ganhos em menos de 1 ano (Portugal)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => fetchCryptoPrices()} disabled={cryptoPricesLoading} title="Actualizar preços via CoinGecko"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
              color: cryptoPricesLoading ? 'var(--text-muted)' : 'var(--text-secondary)',
              padding: '10px 14px', cursor: cryptoPricesLoading ? 'default' : 'pointer',
              fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <RefreshCw size={14} style={{ animation: cryptoPricesLoading ? 'spinIcon 1s linear infinite' : 'none' }} />
            {cryptoPricesLoading ? 'A actualizar…' : 'Actualizar preços'}
          </button>
          <button onClick={() => setShowAddPlatform(true)} style={{
            background: 'linear-gradient(135deg,#f59e0b,#f97316)', border: 'none', borderRadius: 10,
            color: '#000', padding: '10px 18px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}><Plus size={14} /> Nova Plataforma</button>
        </div>
      </div>

      {/* Selector de mês */}
      <CryptoMonthHeader
        year={realYear0} month={realMonth0}
        viewYear={viewYear ?? realYear0} viewMonth={viewMonth ?? realMonth0}
        onViewYear={handleViewYear} onViewMonth={handleViewMonth}
        isLocked={isLocked} onLock={closeMonth} onUnlock={openMonth}
        lockedMonths={lockedMonths}
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalRealized !== 0 ? 5 : 4},1fr)`, gap: 14, marginBottom: 22 }}>
        {kpiCards.map((c, i) => (
          <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: '1.32rem', fontWeight: 800, color: c.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{c.val}</div>
            {c.sub && <div style={{ fontSize: '0.73rem', color: c.color, marginTop: 4, opacity: 0.8 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Banner IRS */}
      {allHoldings.length > 0 && (
        <div style={{
          background: totalIRS > 0 ? 'rgba(251,191,36,0.07)' : 'rgba(74,222,128,0.07)',
          border: `1px solid ${totalIRS > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(74,222,128,0.2)'}`,
          borderRadius: 12, padding: '12px 18px', marginBottom: 22,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {totalIRS > 0
            ? <AlertCircle size={17} style={{ color: '#fbbf24', flexShrink: 0 }} />
            : <Shield size={17} style={{ color: 'var(--green)', flexShrink: 0 }} />}
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {totalIRS > 0 ? (
              <>Se venderes agora todos os ativos com menos de 1 ano, pagas aproximadamente{' '}
                <strong style={{ color: '#fbbf24' }}>{formatEuro(totalIRS)}</strong> de IRS.
                {exemptValue > 0 && <> Valor já isento: <strong style={{ color: 'var(--green)' }}>{formatEuro(exemptValue)}</strong>.</>}
              </>
            ) : (
              <><strong style={{ color: 'var(--green)' }}>Parabéns!</strong> Todos os teus ativos estão isentos de IRS — detidos há mais de 1 ano.</>
            )}
          </p>
        </div>
      )}

      {/* Plataformas */}
      {platforms.length === 0 ? (
        <div style={{ border: '2px dashed rgba(245,158,11,0.25)', borderRadius: 16, padding: '64px 32px', textAlign: 'center' }}>
          <Bitcoin size={52} style={{ color: 'rgba(245,158,11,0.25)', display: 'block', margin: '0 auto 14px' }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Sem plataformas</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Adiciona uma plataforma (Binance, Coinbase, Kraken…) para registar as tuas criptomoedas.
          </p>
          <button onClick={() => setShowAddPlatform(true)} style={{
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 10, color: '#f59e0b', cursor: 'pointer',
            padding: '10px 22px', fontSize: '0.875rem', fontWeight: 600,
          }}>+ Adicionar primeira plataforma</button>
        </div>
      ) : platforms.map(p => (
        <PlatformCard key={p.id} platform={p} mk={mk} isLocked={isLocked}
          onRename={renamePlatform}
          onDelete={deletePlatform}
          onAddHolding={addHolding}
          onUpdate={updateHolding}
          onDeleteHolding={deleteHolding}
          onAddLot={addLot}
          onDeleteLot={deleteLot}
        />
      ))}

      {showAddPlatform && <AddPlatformModal onAdd={addPlatform} onClose={() => setShowAddPlatform(false)} />}
    </div>
  )
}
