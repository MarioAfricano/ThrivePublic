import { useState } from 'react'
import { LayoutDashboard, Building2, TrendingUp, Bitcoin, PiggyBank, FileText, History, Settings, ChevronLeft, ChevronRight, BookMarked, CreditCard, Heart, Lock, Receipt, Rocket } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
// Coloca o teu logótipo em src/assets/logo.png (ou .svg) para substituir o ícone "T"
const _logos = import.meta.glob('../assets/logo.{png,svg,jpg,jpeg,ico,webp}', { eager: true })
const logoSrc = Object.values(_logos)[0]?.default ?? null

export default function Sidebar() {
  const { page, setPage, history } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const historyCount = history?.length ?? 0

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard',   icon: LayoutDashboard, available: true  },
    { id: 'banks',     label: 'Bancos',      icon: Building2,       available: true  },
    { id: 'stocks',    label: 'Ações & ETFs', icon: TrendingUp,      available: true  },
    { id: 'carteira',  label: 'Carteira',    icon: BookMarked,      available: true  },
    { id: 'crypto',    label: 'Criptomoeda', icon: Bitcoin,         available: true  },
    { id: 'ppr',       label: 'PPR',         icon: PiggyBank,       available: true  },
    { id: 'savings',   label: 'Aforro',      icon: FileText,        available: true  },
    { id: 'dividas',   label: 'Dívidas',     icon: CreditCard,      available: true, hidden: false },
    { id: 'saude',     label: 'Saúde',       icon: Heart,           available: true  },
    { id: 'projecao',  label: 'Projeção',    icon: Rocket,          available: true  },
    { id: 'history',   label: 'Histórico',   icon: History,         available: true  },
    { id: 'irs',       label: 'IRS',         icon: Receipt,         available: true  },
    { id: 'security',  label: 'Segurança',   icon: Lock,            available: true  },
  ]

  const W = collapsed ? 60 : 220

  return (
    <aside
      style={{
        width: W,
        minWidth: W,
        height: '100%',
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 8px',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Branding */}
      {!collapsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 10px 16px' }}>
          {logoSrc ? (
            <img src={logoSrc} alt="Thrive" style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, objectFit: 'contain' }} />
          ) : (
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
            }}>T</div>
          )}
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Thrive
          </span>
        </div>
      )}
      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 16px' }}>
          {logoSrc ? (
            <img src={logoSrc} alt="Thrive" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'contain' }} />
          ) : (
            <div style={{ height: 20 }} />
          )}
        </div>
      )}

      {/* Nav Items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {NAV_ITEMS.filter(item => !item.hidden).map(({ id, label, icon: Icon, available }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => available && setPage(id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                border: 'none',
                cursor: available ? 'pointer' : 'default',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : available ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: '0.875rem',
                fontWeight: active ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                width: '100%',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!active && available) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                  e.currentTarget.style.color = 'var(--text)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = available ? 'var(--text-secondary)' : 'var(--text-muted)'
                }
              }}
            >
              {/* Active indicator */}
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: '25%', bottom: '25%',
                  width: 3, borderRadius: 2, background: 'var(--accent)',
                }} />
              )}
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ flex: 1 }}>{label}</span>
              )}
              {/* Badge de contagem para o Histórico */}
              {!collapsed && id === 'history' && historyCount > 0 && (
                <span style={{
                  fontSize: '0.58rem', fontWeight: 700,
                  background: active ? 'rgba(129,140,248,0.3)' : 'var(--wa-10)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  padding: '1px 6px', borderRadius: 8, minWidth: 18, textAlign: 'center',
                }}>
                  {historyCount}
                </span>
              )}
              {!collapsed && !available && (
                <span style={{
                  fontSize: '0.6rem', fontWeight: 600, background: 'var(--bg-hover)',
                  color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  Em breve
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Settings */}
        <button
          onClick={() => setPage('settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '9px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8, border: 'none', cursor: 'pointer',
            background: page === 'settings' ? 'var(--accent-dim)' : 'transparent',
            color: page === 'settings' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.875rem', transition: 'background 0.15s, color 0.15s', width: '100%',
          }}
          title={collapsed ? 'Definições' : undefined}
          onMouseEnter={e => { if (page !== 'settings') { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)' } }}
          onMouseLeave={e => { if (page !== 'settings') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
        >
          <Settings size={16} strokeWidth={page === 'settings' ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Definições</span>}
        </button>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '9px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'var(--text-muted)',
            fontSize: '0.875rem', transition: 'background 0.15s, color 0.15s', width: '100%',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Recolher</span>}
        </button>

        {/* Versão */}
        {!collapsed && (
          <div
            title={`Thrive Finance v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'}`}
            style={{
              padding: '6px 10px 2px',
              fontSize: '0.58rem',
              color: 'var(--text-muted)',
              opacity: 0.55,
              letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'}
          </div>
        )}
      </div>
    </aside>
  )
}
