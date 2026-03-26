import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Code2,
  FileText,
  FolderOpen,
  KeyRound,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings2,
  Sun,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../context/ThemeContext'
import BrandMark from '../ui/BrandMark'

const STORAGE_KEY = 'pdf-gyan:sidebar-collapsed'
const OPENSPACE_KEY = 'pdf-gyan:openspace-open'

export default function AppSidebar({ mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [openspaceOpen, setOpenspaceOpen] = useState(() => localStorage.getItem(OPENSPACE_KEY) !== 'false')
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const toggleOpenspace = () => {
    const next = !openspaceOpen
    setOpenspaceOpen(next)
    localStorage.setItem(OPENSPACE_KEY, String(next))
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const linkClass = ({ isActive }) =>
    `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`

  const isOpenspaceActive = pathname.startsWith('/dashboard') || pathname.startsWith('/settings')

  const sidebarContent = (isMobile = false) => {
    const showLabels = !collapsed || isMobile

    return (
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div className="sidebar-brand">
          <NavLink to="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <BrandMark className={collapsed && !isMobile ? 'h-7 w-7' : 'h-8 w-8'} />
            {showLabels && (
              <span className="truncate font-display text-lg font-bold" style={{ color: 'var(--text)' }}>
                PDF Gyan
              </span>
            )}
          </NavLink>
          {!isMobile && (
            <button type="button" onClick={toggleCollapse} className="sidebar-collapse-btn" title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
          {isMobile && (
            <button type="button" onClick={onMobileClose} className="sidebar-collapse-btn">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Dashboard (Analytics on top) ── */}
        <nav className="sidebar-section">
          {showLabels && <p className="sidebar-group-label">Overview</p>}
          <NavLink to="/dashboard" className={linkClass} onClick={isMobile ? onMobileClose : undefined} title={!showLabels ? 'Dashboard' : undefined}>
            <BarChart3 className="sidebar-icon" />
            {showLabels && <span>Dashboard</span>}
          </NavLink>
        </nav>

        {/* ── Openspace (with submenus) ── */}
        <nav className="sidebar-section">
          {showLabels && (
            <button
              type="button"
              onClick={toggleOpenspace}
              className="sidebar-group-label sidebar-group-toggle"
            >
              Openspace
              <ChevronDown className={`h-3 w-3 transition-transform ${openspaceOpen ? '' : '-rotate-90'}`} />
            </button>
          )}
          {!showLabels && <div className="sidebar-divider" />}

          {(openspaceOpen || !showLabels) && (
            <>
              <NavLink to="/documents" className={linkClass} onClick={isMobile ? onMobileClose : undefined} title={!showLabels ? 'Documents' : undefined}>
                <FileText className="sidebar-icon" />
                {showLabels && <span>Documents</span>}
              </NavLink>
              <NavLink to="/widgets" className={linkClass} onClick={isMobile ? onMobileClose : undefined} title={!showLabels ? 'Widgets' : undefined}>
                <Plug className="sidebar-icon" />
                {showLabels && <span>Widgets</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* ── Workspace (standalone) ── */}
        <nav className="sidebar-section">
          {showLabels && <p className="sidebar-group-label">Workspace</p>}
          <NavLink to="/workspace" className={linkClass} onClick={isMobile ? onMobileClose : undefined} title={!showLabels ? 'Workspace' : undefined}>
            <FolderOpen className="sidebar-icon" />
            {showLabels && <span>Workspace</span>}
          </NavLink>
        </nav>

        {/* ── Tools ── */}
        <nav className="sidebar-section">
          {showLabels && <p className="sidebar-group-label">Tools</p>}
          <NavLink to="/api-docs" className={linkClass} onClick={isMobile ? onMobileClose : undefined} title={!showLabels ? 'API Docs' : undefined}>
            <BookOpen className="sidebar-icon" />
            {showLabels && <span>API Docs</span>}
          </NavLink>
          <NavLink to="/api-keys" className={linkClass} onClick={isMobile ? onMobileClose : undefined} title={!showLabels ? 'API Keys' : undefined}>
            <KeyRound className="sidebar-icon" />
            {showLabels && <span>API Keys</span>}
          </NavLink>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="sidebar-footer">
          <button type="button" onClick={toggleTheme} className="sidebar-link" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Sun className="sidebar-icon" /> : <Moon className="sidebar-icon" />}
            {showLabels && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          <NavLink to="/settings" className={linkClass} onClick={isMobile ? onMobileClose : undefined}>
            <Settings2 className="sidebar-icon" />
            {showLabels && <span>Settings</span>}
          </NavLink>

          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            {showLabels && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{user?.name || 'User'}</p>
                <p className="truncate text-[10px]" style={{ color: 'var(--muted-soft)' }}>{user?.email}</p>
              </div>
            )}
            {showLabels && (
              <button type="button" onClick={handleLogout} className="sidebar-logout" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <aside className={`sidebar-desktop ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {sidebarContent(false)}
      </aside>

      {mobileOpen && <div className="sidebar-mobile-overlay" onClick={onMobileClose} />}

      <aside className={`sidebar-mobile ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {sidebarContent(true)}
      </aside>
    </>
  )
}
