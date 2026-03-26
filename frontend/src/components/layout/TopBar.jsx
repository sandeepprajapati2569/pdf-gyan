import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronRight, Globe, Loader2, Lock, Menu, Monitor } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { updateSettings } from '../../api/settings'
import toast from 'react-hot-toast'

const MODE_CONFIG = {
  public: { label: 'Public', icon: Globe, color: '#10b981', bg: 'rgba(16,185,129,0.12)', desc: 'Uses shared platform AI' },
  private: { label: 'Private', icon: Lock, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', desc: 'Your own OpenAI key + DB' },
  local: { label: 'Local', icon: Monitor, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', desc: 'Local Ollama + your DB' },
}

const BREADCRUMB_MAP = {
  '/dashboard': ['Dashboard'],
  '/documents': ['Openspace', 'Documents'],
  '/widgets': ['Openspace', 'Widgets'],
  '/workspace': ['Workspace'],
  '/analytics': ['Dashboard'],
  '/settings': ['Settings'],
  '/api-docs': ['Tools', 'API Docs'],
  '/api-keys': ['Tools', 'API Keys'],
}

function getBreadcrumb(pathname) {
  // Exact match first
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname]
  // Prefix match
  if (pathname.startsWith('/chat/multi')) return ['Openspace', 'Documents', 'Compare']
  if (pathname.startsWith('/chat/')) return ['Openspace', 'Documents', 'Chat']
  if (pathname.startsWith('/call/')) return ['Openspace', 'Documents', 'Call']
  return ['PDF Gyan']
}

export default function TopBar({ onMenuClick }) {
  const { user, setUser } = useAuth()
  const { pathname } = useLocation()
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const currentMode = user?.mode || 'public'
  const config = MODE_CONFIG[currentMode] || MODE_CONFIG.public
  const crumbs = getBreadcrumb(pathname)

  const handleModeSwitch = async (newMode) => {
    if (newMode === currentMode) { setModeMenuOpen(false); return }
    if (newMode === 'private' || newMode === 'local') {
      setModeMenuOpen(false)
      window.location.href = '/settings'
      toast('Configure your credentials in Settings to switch modes', { icon: '⚙️' })
      return
    }
    setSwitching(true)
    try {
      await updateSettings({ mode: newMode })
      setUser(prev => prev ? { ...prev, mode: newMode } : prev)
      toast.success(`Switched to ${MODE_CONFIG[newMode].label} mode`)
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Failed to switch mode')
    } finally {
      setSwitching(false)
      setModeMenuOpen(false)
    }
  }

  return (
    <div className="topbar">
      {/* Mobile: hamburger */}
      <button type="button" onClick={onMenuClick} className="topbar-menu-btn lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop: breadcrumb */}
      <nav className="hidden lg:flex items-center gap-1 text-xs" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" style={{ color: 'var(--muted-soft)' }} />}
            <span
              className="font-medium"
              style={{ color: i === crumbs.length - 1 ? 'var(--text)' : 'var(--muted-soft)' }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Mode Badge + Switcher */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setModeMenuOpen(!modeMenuOpen)}
          className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5"
          style={{ borderColor: config.bg, background: config.bg, color: config.color }}
        >
          <config.icon className="h-3.5 w-3.5" />
          {config.label} Mode
        </button>

        {modeMenuOpen && (
          <>
            <button type="button" className="fixed inset-0 z-10" onClick={() => setModeMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border p-2 shadow-xl" style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted-soft)' }}>
                Switch Mode
              </p>
              {Object.entries(MODE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleModeSwitch(key)}
                  disabled={switching}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
                  style={{ background: currentMode === key ? 'var(--teal-soft)' : 'transparent' }}
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: cfg.bg }}>
                    {switching ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: cfg.color }} /> : <cfg.icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: currentMode === key ? cfg.color : 'var(--text)' }}>
                      {cfg.label}
                      {currentMode === key && <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--muted-soft)' }}>(active)</span>}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>{cfg.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
