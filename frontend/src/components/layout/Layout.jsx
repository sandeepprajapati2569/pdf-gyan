import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import TopBar from './TopBar'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../context/ThemeContext'

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']
const EMBED_PATHS = ['/embed', '/shared']  // /shared-file/* and /shared-files handled here

function isAuthPath(pathname) {
  return AUTH_PATHS.some(p => pathname.startsWith(p))
}

function isEmbedPath(pathname) {
  return EMBED_PATHS.some(p => pathname.startsWith(p))
}

function BackgroundDecor({ theme }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            theme === 'dark'
              ? 'linear-gradient(180deg, rgba(12, 15, 26, 0.86), rgba(12, 15, 26, 0.98))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(246,244,237,0.96))',
        }}
      />
      <div className="ambient-grid absolute inset-0 opacity-70" />
      <div
        className="absolute left-[-12rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full blur-3xl animate-drift"
        style={{ background: theme === 'dark' ? 'rgba(45, 212, 191, 0.12)' : 'rgba(94, 234, 212, 0.18)' }}
      />
      <div
        className="absolute right-[-10rem] top-[8rem] h-[24rem] w-[24rem] rounded-full blur-3xl animate-drift"
        style={{
          animationDelay: '900ms',
          background: theme === 'dark' ? 'rgba(251, 191, 36, 0.08)' : 'rgba(253, 230, 138, 0.28)',
        }}
      />
      <div
        className="absolute bottom-[-10rem] left-[18%] h-[22rem] w-[22rem] rounded-full blur-3xl animate-drift"
        style={{
          animationDelay: '1800ms',
          background: theme === 'dark' ? 'rgba(96, 165, 250, 0.08)' : 'rgba(125, 211, 252, 0.15)',
        }}
      />
    </div>
  )
}

export default function Layout({ children }) {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Embed/shared routes — no chrome at all
  if (isEmbedPath(pathname)) {
    return <>{children}</>
  }

  // Auth pages (login, register, etc.) — centered layout, no sidebar
  if (isAuthPath(pathname) && !user) {
    return (
      <div className="relative min-h-screen overflow-x-hidden">
        <BackgroundDecor theme={theme} />
        <main className="relative z-10 flex min-h-screen items-center justify-center">{children}</main>
      </div>
    )
  }

  // Authenticated layout with sidebar
  return (
    <div className="app-shell relative min-h-screen overflow-x-hidden">
      <BackgroundDecor theme={theme} />
      <AppSidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="app-content relative z-10">
        <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="app-main-sidebar">{children}</main>
      </div>
    </div>
  )
}
