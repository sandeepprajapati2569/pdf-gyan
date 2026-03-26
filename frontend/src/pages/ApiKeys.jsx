import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Braces, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { getApiKeys, createApiKey, deleteApiKey } from '../api/settings'
import toast from 'react-hot-toast'

export default function ApiKeys() {
  const [keys, setKeys] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState(null)

  useEffect(() => { loadKeys() }, [])

  const loadKeys = async () => {
    try {
      const res = await getApiKeys()
      setKeys(res.data)
    } catch { toast.error('Failed to load API keys') }
    finally { setLoading(false) }
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await createApiKey(name)
      setNewKey(res.data.raw_key)
      setName('')
      loadKeys()
      toast.success('API key created!')
    } catch { toast.error('Failed to create API key') }
    finally { setCreating(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return
    try {
      await deleteApiKey(id)
      setKeys((prev) => prev.filter((key) => key.id !== id))
      toast.success('API key deleted')
    } catch { toast.error('Failed to delete') }
  }

  const copyKey = (key) => {
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="page-shell max-w-6xl py-8 sm:py-10">
      {/* Header */}
      <section className="premium-card p-6 sm:p-8">
        <div className="section-intro">
          <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">API Keys</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Generate keys for your integrations, rotate them safely, and manage access to the API.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Active keys', value: keys.length, accent: 'var(--teal)' },
            { label: 'Key format', value: 'pgyan_...', accent: '#6366f1' },
          ].map((item) => (
            <div key={item.label} className="soft-card flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${item.accent}12` }}>
                <KeyRound className="h-4 w-4" style={{ color: item.accent }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create Key */}
      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="icon-shell h-11 w-11">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Create a new key</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Name each key so you can track which integration uses it.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="field-label">Key label</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. support-bot, internal-dashboard"
                className="field-input" />
            </div>
            <button type="submit" disabled={creating || !name.trim()} className="btn-primary">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create key
            </button>
          </form>
        </div>

        <div className="premium-card p-6" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">How it works</p>
          <h3 className="mt-2 text-xl font-bold text-white">Using your API key</h3>
          <div className="mt-5 space-y-3">
            {[
              'Include in the Authorization header as Bearer token',
              'Each key is scoped to your workspace',
              'Rotate keys anytime — create a new one, then delete the old',
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/10 text-[10px] font-bold text-teal-400 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-xs leading-5 text-slate-300">{tip}</p>
              </div>
            ))}
          </div>
          <Link to="/api-docs" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
            <Braces className="h-3.5 w-3.5" /> View API Docs
          </Link>
        </div>
      </section>

      {/* New Key Alert */}
      {newKey && (
        <section className="mt-6 premium-card overflow-hidden" style={{ border: '1px solid #f59e0b40', background: 'linear-gradient(180deg, #fffbeb, #fff7ed)' }}>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: '#f59e0b15' }}>
                  <AlertCircle className="h-5 w-5" style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Save this key now</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    The raw key is shown only once. Copy and store it securely before dismissing.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setNewKey(null)} className="btn-ghost text-xs shrink-0">Dismiss</button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: '#f59e0b30', background: 'white' }}>
              <code className="flex-1 overflow-x-auto text-sm font-mono font-medium text-slate-800">{newKey}</code>
              <button type="button" onClick={() => copyKey(newKey)} className="btn-primary shrink-0 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Keys List */}
      <section className="mt-6 premium-card overflow-hidden">
        <div className="border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="icon-shell h-11 w-11">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Your keys</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Review active keys and remove any you no longer need.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--teal)' }} />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex min-h-[14rem] flex-col items-center justify-center px-6 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'var(--teal-soft)' }}>
              <KeyRound className="h-6 w-6" style={{ color: 'var(--teal)' }} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-950">No API keys yet</h3>
            <p className="mt-1.5 max-w-sm text-xs leading-5" style={{ color: 'var(--muted)' }}>
              Create your first key above to start using the API.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {keys.map((key) => (
              <div key={key.id} className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/40">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--teal-soft)' }}>
                  <KeyRound className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{key.name}</p>
                  <div className="mt-1 flex items-center gap-2.5 text-xs" style={{ color: 'var(--muted-soft)' }}>
                    <code className="rounded-md px-1.5 py-0.5 font-mono text-[11px]" style={{ background: 'var(--surface-soft)' }}>{key.key_prefix}...</code>
                    <span>{key.last_used ? `Used ${new Date(key.last_used).toLocaleDateString()}` : 'Never used'}</span>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(key.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition hover:bg-red-50 hover:border-red-200"
                  style={{ borderColor: 'var(--border)' }} title="Delete key">
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
