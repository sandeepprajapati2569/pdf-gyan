import { useEffect, useState } from 'react'
import { AlertCircle, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { getApiKeys, createApiKey, deleteApiKey } from '../api/settings'
import toast from 'react-hot-toast'

export default function ApiKeys() {
  const [keys, setKeys] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState(null)

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      const res = await getApiKeys()
      setKeys(res.data)
    } catch {
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
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
    } catch {
      toast.error('Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return
    try {
      await deleteApiKey(id)
      setKeys((prev) => prev.filter((key) => key.id !== id))
      toast.success('API key deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const copyKey = (key) => {
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="page-shell max-w-6xl py-8 sm:py-10">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="premium-card p-6 sm:p-8">
          <span className="eyebrow">Developer access</span>
          <div className="mt-5 space-y-3">
            <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">API keys</h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Generate keys for your integrations, rotate them safely, and keep everything tied back to a clean API workflow.
            </p>
          </div>
        </div>

        <div className="premium-card p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-12 w-12">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Create a new key</h2>
              <p className="text-sm text-slate-500">Name each key so it is easy to map back to the integration using it.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <div>
              <label className="field-label">Key label</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="For example: support-bot or internal-dashboard"
                className="field-input"
              />
            </div>

            <button type="submit" disabled={creating || !name.trim()} className="btn-primary">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create key
            </button>
          </form>
        </div>
      </section>

      {newKey && (
        <section className="premium-card mt-6 border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,247,237,0.92))] p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="icon-shell-warm h-12 w-12">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Save this key now</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                  For security, the raw key is shown only once. Copy it now and store it somewhere safe before dismissing this card.
                </p>
              </div>
            </div>

            <button type="button" onClick={() => setNewKey(null)} className="btn-ghost">
              Dismiss
            </button>
          </div>

          <div className="mt-5 rounded-[22px] border border-amber-200/80 bg-white/90 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 overflow-x-auto text-sm font-medium text-slate-800">{newKey}</code>
              <button type="button" onClick={() => copyKey(newKey)} className="btn-secondary shrink-0">
                <Copy className="h-4 w-4" />
                Copy key
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="premium-card mt-6 overflow-hidden">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-12 w-12">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Your keys</h2>
              <p className="text-sm text-slate-500">Review active integrations and remove anything you no longer need.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[14rem] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center px-6 text-center">
            <div className="icon-shell h-14 w-14">
              <KeyRound className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-slate-950">No API keys yet</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
              Create your first key to start uploading documents and chatting through the API.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {keys.map((key) => (
              <div key={key.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-950">{key.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-slate-700">{key.key_prefix}...</span>
                    <span>
                      {key.last_used
                        ? `Last used ${new Date(key.last_used).toLocaleDateString()}`
                        : 'Not used yet'}
                    </span>
                  </div>
                </div>

                <button type="button" onClick={() => handleDelete(key.id)} className="btn-danger shrink-0">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
