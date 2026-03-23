import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronDown, KeyRound, LogIn, LogOut, Menu, PanelsTopLeft, Settings2, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import BrandMark from '../ui/BrandMark'

const productLinks = [
  { to: '/dashboard', label: 'Documents', icon: PanelsTopLeft },
  { to: '/api-docs', label: 'API Docs', icon: BookOpen },
  { to: '/api-keys', label: 'API Keys', icon: KeyRound },
  { to: '/settings', label: 'Settings', icon: Settings2 },
]

const marketingLinks = [{ to: '/api-docs', label: 'API' }]

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const openLogoutConfirm = () => {
    setAccountMenuOpen(false)
    setMobileOpen(false)
    setLogoutConfirmOpen(true)
  }

  const closeLogoutConfirm = () => {
    setLogoutConfirmOpen(false)
  }

  const handleLogout = () => {
    closeLogoutConfirm()
    logout()
    setMobileOpen(false)
    navigate('/')
  }

  const navLinkClass = ({ isActive }) =>
    `nav-link ${isActive ? 'nav-link-active' : ''}`.trim()

  return (
    <>
      <div className="app-header-backdrop" aria-hidden="true" />
      <nav className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-4 rounded-[30px] border border-white/65 bg-[rgba(255,255,255,0.68)] px-4 py-3 shadow-[0_18px_55px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:px-5">
            <Link
              to={user ? '/dashboard' : '/'}
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 items-center gap-3"
            >
              <BrandMark className="h-11 w-11 shrink-0" />
              <div className="min-w-0">
                <p className="font-display truncate text-lg text-slate-950 sm:text-xl">PDF Gyan</p>
                <p className="hidden text-xs text-slate-500 sm:block">Document intelligence that feels calm and capable</p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 lg:flex">
              {user ? (
                <>
                  <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1">
                    {productLinks.map((item) => (
                      <NavLink key={item.to} to={item.to} className={navLinkClass}>
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>

                  <div
                    className="relative"
                    onMouseEnter={() => setAccountMenuOpen(true)}
                    onMouseLeave={() => setAccountMenuOpen(false)}
                    onFocusCapture={() => setAccountMenuOpen(true)}
                    onBlurCapture={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setAccountMenuOpen(false)
                      }
                    }}
                  >
                    <button
                      type="button"
                      className={`flex items-center gap-3 rounded-full border px-3 py-2 transition ${
                        accountMenuOpen
                          ? 'border-slate-300/80 bg-white/90 shadow-[0_16px_36px_rgba(15,23,42,0.12)]'
                          : 'border-slate-200/80 bg-white/72'
                      }`}
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
                        {initials(user?.name) || 'PG'}
                      </div>
                      <div className="max-w-[9rem] text-left xl:max-w-[10rem]">
                        <p className="truncate text-sm font-semibold text-slate-950">{user?.name || 'Workspace'}</p>
                        <p className="truncate text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition ${accountMenuOpen ? 'rotate-180 text-slate-600' : ''}`}
                      />
                    </button>

                    <div
                      className={`absolute right-0 top-full z-20 mt-3 w-72 transition ${
                        accountMenuOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
                      }`}
                    >
                      <div className="rounded-[28px] border border-white/70 bg-[rgba(255,255,255,0.88)] p-3 shadow-[0_22px_60px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
                        <div className="rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Account</p>
                          <p className="mt-2 truncate text-sm font-semibold text-slate-950">{user?.name || 'Workspace'}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{user?.email}</p>
                        </div>

                        <button
                          type="button"
                          onClick={openLogoutConfirm}
                          className="mt-3 flex w-full items-center justify-between rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50/90 hover:text-rose-700"
                        >
                          <span className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                              <LogOut className="h-4 w-4" />
                            </span>
                            Logout
                          </span>
                          <span className="text-xs font-medium text-slate-400">Confirm first</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {marketingLinks.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `btn-ghost ${isActive ? 'border-slate-300 bg-white/86 text-slate-950' : ''}`.trim()
                      }
                    >
                      <BookOpen className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                  <Link to="/login" className="btn-ghost">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link to="/register" className="btn-primary">
                    <Sparkles className="h-4 w-4" />
                    Start Free
                  </Link>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-700 transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-slate-950 lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {mobileOpen && (
            <div className="mt-3 overflow-hidden rounded-[28px] border border-white/65 bg-[rgba(255,255,255,0.76)] p-3 shadow-[0_18px_55px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:hidden">
              <div className="space-y-2">
                {(user ? productLinks : marketingLinks).map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]'
                          : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-950'
                      }`
                    }
                  >
                    {item.icon ? <item.icon className="h-4 w-4" /> : null}
                    {item.label}
                  </NavLink>
                ))}
              </div>

              {user ? (
                <button type="button" onClick={openLogoutConfirm} className="btn-ghost mt-3 w-full justify-center">
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              ) : (
                <div className="mt-3 grid gap-2">
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-ghost justify-center">
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-primary justify-center">
                    <Sparkles className="h-4 w-4" />
                    Create account
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/28 px-4 backdrop-blur-sm" onClick={closeLogoutConfirm}>
          <div
            className="w-full max-w-md rounded-[32px] border border-white/70 bg-[rgba(255,255,255,0.92)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Confirm logout</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Log out of your workspace?</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  You will be signed out on this device and returned to the landing page.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeLogoutConfirm} className="btn-ghost justify-center">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-rose-700"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
