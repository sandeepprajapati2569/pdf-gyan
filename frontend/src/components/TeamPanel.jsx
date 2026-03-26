import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  Crown,
  Loader2,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
  owner: { label: 'Owner', icon: Crown, color: '#d97706' },
  admin: { label: 'Admin', icon: Shield, color: '#6366f1' },
  member: { label: 'Member', icon: Users, color: 'var(--teal)' },
  viewer: { label: 'Viewer', icon: Users, color: 'var(--muted-soft)' },
}

export default function TeamPanel() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Create team
  const [showCreate, setShowCreate] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [creating, setCreating] = useState(false)

  // Invite
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  const loadTeams = useCallback(async () => {
    try {
      const res = await client.get('/api/teams')
      setTeams(res.data || [])
      if (res.data?.length > 0 && !activeTeamId) {
        setActiveTeamId(res.data[0].id)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [activeTeamId])

  const loadMembers = useCallback(async () => {
    if (!activeTeamId) return
    setLoadingMembers(true)
    try {
      const res = await client.get(`/api/teams/${activeTeamId}/members`)
      setMembers(res.data || [])
    } catch { setMembers([]) }
    finally { setLoadingMembers(false) }
  }, [activeTeamId])

  useEffect(() => { loadTeams() }, [loadTeams])
  useEffect(() => { loadMembers() }, [loadMembers])

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!newTeamName.trim()) return
    setCreating(true)
    try {
      const res = await client.post('/api/teams', { name: newTeamName.trim() })
      toast.success('Team created!')
      setNewTeamName('')
      setShowCreate(false)
      setActiveTeamId(res.data.id)
      loadTeams()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create team')
    } finally { setCreating(false) }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !activeTeamId) return
    setInviting(true)
    try {
      const res = await client.post(`/api/teams/${activeTeamId}/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      toast.success(res.data.message || 'Invited!')
      setInviteEmail('')
      setShowInvite(false)
      loadMembers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invite failed')
    } finally { setInviting(false) }
  }

  const handleRemoveMember = async (memberId) => {
    if (!activeTeamId) return
    try {
      await client.delete(`/api/teams/${activeTeamId}/members/${memberId}`)
      toast.success('Member removed')
      loadMembers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove')
    }
  }

  const handleRoleChange = async (memberId, newRole) => {
    if (!activeTeamId) return
    try {
      await client.patch(`/api/teams/${activeTeamId}/members/${memberId}`, { role: newRole })
      toast.success('Role updated')
      loadMembers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update role')
    }
  }

  const activeTeam = teams.find(t => t.id === activeTeamId)

  if (loading) {
    return (
      <div className="premium-card flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--teal)' }} />
      </div>
    )
  }

  return (
    <div className="premium-card overflow-hidden">
      {/* Header */}
      <div className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-soft)' }}>Collaboration</p>
            <h2 className="mt-1 font-display text-2xl" style={{ color: 'var(--text)' }}>Team Workspaces</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Invite colleagues, assign roles, and share documents across your team.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary shrink-0 text-sm"
          >
            <Plus className="h-4 w-4" /> New Team
          </button>
        </div>

        {/* Team selector */}
        {teams.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {teams.map(team => (
              <button
                key={team.id}
                type="button"
                onClick={() => setActiveTeamId(team.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  team.id === activeTeamId
                    ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]'
                    : 'border-[var(--border)] hover:border-[var(--teal-soft)]'
                }`}
                style={{ color: team.id === activeTeamId ? undefined : 'var(--muted)' }}
              >
                <Users className="mr-1.5 inline h-3.5 w-3.5" />
                {team.name}
                <span className="ml-2 text-xs opacity-60">{team.member_count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Form */}
      {showCreate && (
        <div className="border-b p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-soft)' }}>
          <form onSubmit={handleCreateTeam} className="flex items-center gap-3">
            <input
              type="text"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="Team name..."
              className="field-input flex-1"
              maxLength={100}
              autoFocus
            />
            <button type="submit" disabled={creating || !newTeamName.trim()} className="btn-primary shrink-0 text-sm">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost !rounded-full !p-2">
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Members */}
      {activeTeam ? (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Members ({members.length})
            </h3>
            {(activeTeam.role === 'owner' || activeTeam.role === 'admin') && (
              <button
                type="button"
                onClick={() => setShowInvite(!showInvite)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                style={{ borderColor: 'var(--teal-soft)', color: 'var(--teal)' }}
              >
                <UserPlus className="h-3 w-3" /> Invite
              </button>
            )}
          </div>

          {/* Invite Form */}
          {showInvite && (
            <form onSubmit={handleInvite} className="mb-4 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-soft)' }}>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-soft)' }} />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="field-input flex-1"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-xs font-medium"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button type="submit" disabled={inviting} className="btn-primary shrink-0 text-sm">
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </button>
              </div>
            </form>
          )}

          {/* Members List */}
          {loadingMembers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--teal)' }} />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map(member => {
                const roleInfo = ROLE_LABELS[member.role] || ROLE_LABELS.member
                const RoleIcon = roleInfo.icon
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--surface)' }}>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-bold" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
                      {(member.name || member.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {member.name || member.email}
                      </p>
                      {member.name && <p className="truncate text-xs" style={{ color: 'var(--muted-soft)' }}>{member.email}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: roleInfo.color }}>
                        <RoleIcon className="h-3 w-3" />
                        {roleInfo.label}
                      </span>
                      {member.status === 'invited' && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--amber)' }}>Pending</span>
                      )}
                      {member.role !== 'owner' && (activeTeam.role === 'owner' || activeTeam.role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg transition hover:text-red-500"
                          style={{ color: 'var(--muted-soft)' }}
                          title="Remove member"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl" style={{ background: 'var(--teal-soft)' }}>
            <Users className="h-7 w-7" style={{ color: 'var(--teal)' }} />
          </div>
          <h3 className="mt-5 text-lg font-semibold" style={{ color: 'var(--text)' }}>No teams yet</h3>
          <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--muted)' }}>
            Create a team to invite colleagues, share documents, and collaborate on insights together.
          </p>
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary mt-5 text-sm">
            <Plus className="h-4 w-4" /> Create your first team
          </button>
        </div>
      )}
    </div>
  )
}
