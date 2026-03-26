import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
const MOD = isMac ? 'metaKey' : 'ctrlKey'
const MOD_LABEL = isMac ? '\u2318' : 'Ctrl'

export const SHORTCUTS = [
  { keys: `${MOD_LABEL}+K`, label: 'Search documents', action: 'search' },
  { keys: `${MOD_LABEL}+N`, label: 'New chat', action: 'new-chat' },
  { keys: `${MOD_LABEL}+U`, label: 'Upload document', action: 'upload' },
  { keys: `${MOD_LABEL}+D`, label: 'Go to Dashboard', action: 'dashboard' },
  { keys: `${MOD_LABEL}+/`, label: 'Show shortcuts', action: 'help' },
]

export function useKeyboardShortcuts({ onSearch, onNewChat, onUpload } = {}) {
  const [showHelp, setShowHelp] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      // Don't trigger when typing in inputs
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only allow Escape
        if (e.key === 'Escape') {
          document.activeElement.blur()
          return
        }
        return
      }

      if (!e[MOD]) return

      switch (e.key.toLowerCase()) {
        case 'k':
          e.preventDefault()
          onSearch?.()
          break
        case 'n':
          e.preventDefault()
          onNewChat?.()
          break
        case 'u':
          e.preventDefault()
          onUpload?.()
          break
        case 'd':
          e.preventDefault()
          navigate('/dashboard')
          break
        case '/':
          e.preventDefault()
          setShowHelp(prev => !prev)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, onSearch, onNewChat, onUpload])

  return { showHelp, setShowHelp }
}
