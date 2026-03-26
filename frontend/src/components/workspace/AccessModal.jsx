import { useEffect, useState } from 'react'
import { Globe, Loader2, Lock, Users, X } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

const ACCESS_OPTIONS = [
  {
    value: 'workspace',
    label: 'Workspace',
    desc: 'Everyone in the workspace can view and access',
    icon: Globe,
    color: 'var(--teal)',
    bg: 'var(--teal-soft)',
  },
  {
    value: 'shared',
    label: 'Shared',
    desc: 'Only you and selected members can access',
    icon: Users,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
  },
  {
    value: 'private',
    label: 'Private',
    desc: 'Only you can view and access this',
    icon: Lock,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
]

export default function AccessModal({ itemType, itemId, itemName, currentAccess, onClose, onSaved }) {
  const [level, setLevel] = useState(currentAccess?.access_level || 'workspace')
  const [sharedWith, setSharedWith] = useState(currentAccess?.shared_with || [])
  const [members, setMembers] = useState([])
  const [saving, setSaving] = useState(false)
  const [memberInput, setMemberInput] = useState('')

  // Load team members when "shared" is selected
  useEffect(() => {
    if (level === 'shared') {
      client.get('/api/teams/members').then(res => {
        setMembers((res.data || []).filter(m => m.status === 'active'))
      }).catch(() => {})
    }
  }, [level])

  const toggleMember = (userId) => {
    setSharedWith(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const endpoint = itemType === 'folder'
        ? `/api/workspace/folders/${itemId}/access`
        : `/api/workspace/files/${itemId}/access`
      await client.patch(endpoint, {
        access_level: level,
        shared_with: level === 'shared' ? sharedWith : [],
      })
      toast.success(`Access updated to ${level}`)
      onSaved?.({ access_level: level, shared_with: level === 'shared' ? sharedWith : [] })
      onClose()
    } catch {
      toast.error('Failed to update access')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 70 }}>
      <button type="button" className="modal-backdrop" onClick={onClose} />
      <div className="premium-card modal-content w-full max-w-md p-6" style={{ zIndex: 71 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Access Control</h2>
            <p className="text-xs mt-0.5 truncate max-w-[280px]" style={{ color: 'var(--muted-soft)' }}>{itemName}</p>
          </div>
          <button onClick={onClose} className="btn-ghost !rounded-full !p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Access level options */}
        <div className="space-y-2">
          {ACCESS_OPTIONS.map(opt => {
            const Icon = opt.icon
            const isSelected = level === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLevel(opt.value)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                  isSelected ? 'ring-2' : 'hover:bg-white/40'
                }`}
                style={{
                  borderColor: isSelected ? opt.color : 'var(--border)',
                  ringColor: isSelected ? opt.color : undefined,
                  background: isSelected ? opt.bg : 'var(--surface)',
                }}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: opt.bg }}>
                  <Icon className="h-4 w-4" style={{ color: opt.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: isSelected ? opt.color : 'var(--text)' }}>{opt.label}</p>
                  <p className="text-[11px] leading-4 mt-0.5" style={{ color: 'var(--muted-soft)' }}>{opt.desc}</p>
                </div>
                {isSelected && (
                  <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: opt.color }}>
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Team member picker (shown when "shared" is selected) */}
        {level === 'shared' && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--muted-soft)' }}>
              Share with team members
            </p>
            {members.length === 0 ? (
              <div className="soft-card p-3 text-xs" style={{ color: 'var(--muted-soft)' }}>
                No team members found. Invite members from Settings first.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
                {members.map(m => {
                  const isChecked = sharedWith.includes(m.user_id)
                  return (
                    <button
                      key={m.user_id || m.email}
                      type="button"
                      onClick={() => toggleMember(m.user_id)}
                      className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-white/60"
                    >
                      <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                        isChecked ? 'border-[#6366f1] bg-[#6366f1] text-white' : 'border-[var(--border)]'
                      }`}>
                        {isChecked && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{m.email}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>{m.role}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {sharedWith.length > 0 && (
              <p className="mt-2 text-[10px]" style={{ color: '#6366f1' }}>
                {sharedWith.length} member{sharedWith.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Save Access
          </button>
        </div>
      </div>
    </div>
  )
}
