import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search, LayoutDashboard, Building2, TrendingUp, BookMarked, Bitcoin,
  PiggyBank, FileText, History, Settings, CreditCard, Heart, Lock, Receipt,
  Undo2, Save, Rocket,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { MONTHS } from '../data/initialData.js'
import { buildLockMonthPatch, isMonthFullyLocked } from '../utils/lockMonth.js'

// ── Static page catalogue ─────────────────────────────────────
const PAGES = [
  { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard, color: '#818cf8' },
  { id: 'banks',     label: 'Bancos',       icon: Building2,       color: '#60a5fa' },
  { id: 'stocks',    label: 'Ações & ETFs', icon: TrendingUp,      color: '#4ade80' },
  { id: 'carteira',  label: 'Carteira',     icon: BookMarked,      color: '#4ade80' },
  { id: 'crypto',    label: 'Criptomoeda',  icon: Bitcoin,         color: '#f97316' },
  { id: 'ppr',       label: 'PPR',          icon: PiggyBank,       color: '#f472b6' },
  { id: 'savings',   label: 'Aforro',       icon: FileText,        color: '#60a5fa' },
  { id: 'dividas',   label: 'Dívidas',      icon: CreditCard,      color: '#f87171' },
  { id: 'saude',     label: 'Saúde',        icon: Heart,           color: '#f43f5e' },
  { id: 'projecao',  label: 'Projeção',     icon: Rocket,          color: '#34d399' },
  { id: 'history',   label: 'Histórico',    icon: History,         color: '#a78bfa' },
  { id: 'irs',       label: 'IRS',          icon: Receipt,         color: '#fb923c' },
  { id: 'security',  label: 'Segurança',    icon: Lock,            color: '#94a3b8' },
  { id: 'settings',  label: 'Definições',   icon: Settings,        color: '#94a3b8' },
]

const TYPE_BADGE_COLOR = {
  página: '#818cf8', comando: '#4ade80', ação: '#4ade80', ETF: '#22d3ee',
  crypto: '#f97316', dívida: '#f87171', banco: '#fbbf24',
}

// Comandos executáveis (para além da navegação)
function buildCommandItems({ data, saveData, persistData, undoLast, history }) {
  const items = []

  if (history?.length > 0) {
    const last = history[history.length - 1]
    items.push({
      id: 'cmd:undo', type: 'comando',
      label: 'Desfazer última alteração', sub: last.label || '',
      icon: Undo2, color: '#a78bfa',
      action: () => undoLast(),
      searchText: 'desfazer undo anular reverter última alteração',
    })
  }

  items.push({
    id: 'cmd:checkpoint', type: 'comando',
    label: 'Guardar checkpoint', sub: 'Força um save imediato',
    icon: Save, color: '#4ade80',
    action: () => persistData(),
    searchText: 'guardar checkpoint save gravar',
  })

  // Fechar o mês anterior — nos TRÊS sistemas de lock (global, ações, crypto)
  const now = new Date()
  const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const yd = data?.years?.[py]
  if (yd?.months?.[pm] && !isMonthFullyLocked(data, py, pm)) {
    items.push({
      id: 'cmd:lock-month', type: 'comando',
      label: `Fechar ${MONTHS[pm]} ${py}`, sub: 'Congela bancos, ações e crypto',
      icon: Lock, color: '#fbbf24',
      action: () => {
        const patch = buildLockMonthPatch(data, py, pm)
        if (Object.keys(patch).length) saveData(patch)
      },
      searchText: `fechar mês ${MONTHS[pm].toLowerCase()} lock bloquear congelar`,
    })
  }

  return items
}

function buildAllItems(data, setPage) {
  const items = []

  for (const p of PAGES) {
    items.push({
      id: `page:${p.id}`, type: 'página',
      label: p.label, sub: null,
      icon: p.icon, color: p.color,
      action: () => setPage(p.id),
      searchText: p.label.toLowerCase(),
    })
  }

  for (const h of data?.stocks?.acoes?.holdings || []) {
    items.push({
      id: `stock:${h.id}`, type: 'ação',
      label: h.ticker || '—', sub: h.name || '',
      icon: TrendingUp, color: '#4ade80',
      action: () => setPage('stocks'),
      searchText: `${h.ticker} ${h.name}`.toLowerCase(),
    })
  }

  for (const h of data?.stocks?.etfs?.holdings || []) {
    items.push({
      id: `etf:${h.id}`, type: 'ETF',
      label: h.ticker || '—', sub: h.name || '',
      icon: TrendingUp, color: '#22d3ee',
      action: () => setPage('stocks'),
      searchText: `${h.ticker} ${h.name}`.toLowerCase(),
    })
  }

  for (const platform of data?.crypto?.platforms || []) {
    for (const h of platform.holdings || []) {
      items.push({
        id: `crypto:${h.id}`, type: 'crypto',
        label: h.ticker || '—', sub: platform.name || '',
        icon: Bitcoin, color: '#f97316',
        action: () => setPage('crypto'),
        searchText: `${h.ticker} ${platform.name}`.toLowerCase(),
      })
    }
  }

  for (const d of data?.debts || []) {
    items.push({
      id: `debt:${d.id}`, type: 'dívida',
      label: d.name || '—', sub: d.ativa === false ? 'Liquidada' : 'Ativa',
      icon: CreditCard, color: '#f87171',
      action: () => setPage('dividas'),
      searchText: (d.name || '').toLowerCase(),
    })
  }

  for (const platform of data?.banks?.platforms || []) {
    items.push({
      id: `bank:${platform.id}`, type: 'banco',
      label: platform.name || '—',
      sub: `${(platform.accounts || []).length} conta(s)`,
      icon: Building2, color: '#fbbf24',
      action: () => setPage('banks'),
      searchText: (platform.name || '').toLowerCase(),
    })
  }

  return items
}

function applySearch(items, query) {
  const q = query.trim().toLowerCase()
  if (!q) return items.filter(i => i.type === 'página' || i.type === 'comando')
  return items
    .filter(i => i.searchText.includes(q))
    .sort((a, b) => a.searchText.indexOf(q) - b.searchText.indexOf(q))
    .slice(0, 8)
}

const KBD = ({ children }) => (
  <kbd style={{
    fontSize: '0.62rem', color: 'var(--text-muted)',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 3, padding: '1px 4px', marginRight: 4,
  }}>
    {children}
  </kbd>
)

export default function CommandPalette({ onClose }) {
  const { data, setPage, saveData, persistData, undoLast, history } = useApp()
  const [query,    setQuery]    = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const allItems = useMemo(() => [
    ...buildCommandItems({ data, saveData, persistData, undoLast, history }),
    ...buildAllItems(data, setPage),
  ], [data, setPage, saveData, persistData, undoLast, history])
  const results  = useMemo(() => applySearch(allItems, query), [allItems, query])

  useEffect(() => { setSelected(0) }, [results]) // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const el = listRef.current?.children[selected]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const trigger = useCallback((item) => {
    item?.action()
    onClose()
  }, [onClose])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter')  { e.preventDefault(); trigger(results[selected]) }
    else if (e.key === 'Escape') { onClose() }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      />

      {/* Palette card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pesquisa global"
        style={{
          position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, width: '100%', maxWidth: 560,
          background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
          borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}
      >
        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={15} color="var(--text-muted)" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pesquisar páginas, ações, crypto, dívidas…"
            aria-label="Pesquisa global"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.925rem' }}
          />
          <kbd style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }} role="listbox">
          {results.length === 0
            ? <div style={{ padding: '18px', textAlign: 'center', fontSize: '0.825rem', color: 'var(--text-muted)' }}>Sem resultados para "{query}"</div>
            : results.map((item, i) => {
                const Icon   = item.icon
                const active = i === selected
                const badge  = TYPE_BADGE_COLOR[item.type] || 'var(--text-muted)'
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => trigger(item)}
                    onMouseEnter={() => setSelected(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none',
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: active ? 'rgba(129,140,248,0.18)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={14} color={active ? 'var(--accent)' : item.color} aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: active ? 'var(--text)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </div>
                      {item.sub && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.sub}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: badge, background: `${badge}1a`, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                      {item.type}
                    </span>
                  </button>
                )
              })
          }
        </div>

        {/* Footer hints */}
        <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          <span><KBD>↑↓</KBD>navegar</span>
          <span><KBD>↵</KBD>abrir</span>
          <span><KBD>Esc</KBD>fechar</span>
        </div>
      </div>
    </>
  )
}
