import { Keyboard, X } from 'lucide-react'
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts'

export default function ShortcutsModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop"
        onClick={onClose}
      />
      <div className="premium-card relative z-10 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[var(--teal)]" />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl text-[var(--muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between py-2">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{s.label}</span>
              <kbd className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-mono font-semibold" style={{ color: 'var(--text)', background: 'var(--surface)' }}>
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>Press <kbd className="font-mono">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  )
}
