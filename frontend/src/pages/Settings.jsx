import { useEffect, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  Database,
  Globe,
  KeyRound,
  Loader2,
  Shield,
} from 'lucide-react'
import { getSettings, getUsage, updateSettings } from '../api/settings'
import { useAuth } from '../context/useAuth'
import toast from 'react-hot-toast'

export default function Settings() {
  const { setUser } = useAuth()
  const [openaiKey, setOpenaiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [mode, setMode] = useState('public')
  const [selectedMode, setSelectedMode] = useState('public')
  const [mongodbUrl, setMongodbUrl] = useState('')
  const [mongodbDbName, setMongodbDbName] = useState('pdf_gyan')
  const [hasPrivateMongodb, setHasPrivateMongodb] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    loadSettings()
    loadUsage()
  }, [])

  const syncUserSettings = (nextSettings) => {
    setUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            mode: nextSettings.mode,
            has_private_mongodb: nextSettings.has_private_mongodb,
          }
        : currentUser
    )
  }

  const loadSettings = async () => {
    try {
      const res = await getSettings()
      const nextMode = res.data.mode || 'public'

      setHasKey(res.data.has_own_openai_key)
      setMode(nextMode)
      setSelectedMode(nextMode)
      setHasPrivateMongodb(res.data.has_private_mongodb || false)
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const loadUsage = async () => {
    try {
      const res = await getUsage()
      setUsage(res.data)
    } catch {
      setUsage(null)
    }
  }

  const handleSwitchToPublic = async () => {
    setSelectedMode('public')

    if (mode === 'public' || saving) return

    setSaving(true)
    try {
      const res = await updateSettings({ mode: 'public' })

      setHasKey(res.data.has_own_openai_key)
      setMode(res.data.mode)
      setSelectedMode('public')
      setHasPrivateMongodb(res.data.has_private_mongodb)
      syncUserSettings(res.data)
      toast.success('Switched to public mode')
    } catch (err) {
      setSelectedMode(mode)
      toast.error(err.response?.data?.detail || 'Failed to switch mode')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectPrivate = () => {
    if (saving) return
    setSelectedMode('private')
  }

  const handleSavePrivateMode = async (event) => {
    event.preventDefault()

    const nextOpenaiKey = openaiKey.trim()
    const nextMongoUrl = mongodbUrl.trim()
    const nextMongoDbName = mongodbDbName.trim() || 'pdf_gyan'

    if (!hasKey && !nextOpenaiKey) {
      toast.error('Add your OpenAI API key to continue')
      return
    }

    if (!hasPrivateMongodb && !nextMongoUrl) {
      toast.error('Add your MongoDB URL to continue')
      return
    }

    setSaving(true)
    try {
      const payload = { mode: 'private' }

      if (nextOpenaiKey) {
        payload.own_openai_key = nextOpenaiKey
      }

      if (nextMongoUrl) {
        payload.private_mongodb_url = nextMongoUrl
        payload.private_mongodb_db_name = nextMongoDbName
      }

      const res = await updateSettings(payload)

      setHasKey(res.data.has_own_openai_key)
      setMode(res.data.mode)
      setSelectedMode('private')
      setHasPrivateMongodb(res.data.has_private_mongodb)
      setOpenaiKey('')
      setMongodbUrl('')
      setMongodbDbName('pdf_gyan')
      syncUserSettings(res.data)
      toast.success('Private mode is ready')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save private mode')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell max-w-6xl py-8">
        <div className="premium-card flex min-h-[16rem] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
        </div>
      </div>
    )
  }

  const usageCards = usage
    ? [
        { label: 'Total requests', value: usage.total_requests.toLocaleString() },
        { label: 'Total tokens', value: usage.total_tokens.toLocaleString() },
        { label: 'Prompt tokens', value: usage.prompt_tokens.toLocaleString() },
        { label: 'Completion tokens', value: usage.completion_tokens.toLocaleString() },
      ]
    : []

  const currentModeMeta =
    mode === 'private'
      ? {
          icon: Database,
          title: 'Private workspace',
          description: 'New uploads and chats use your MongoDB database and your OpenAI key.',
          pillLabel: 'Private active',
          pillClass: 'status-pill status-ready',
        }
      : {
          icon: Globe,
          title: 'Public workspace',
          description: 'Hosted storage stays managed for you so setup remains fast and low-friction.',
          pillLabel: 'Public active',
          pillClass: 'soft-pill bg-white/80 text-slate-600',
        }

  const CurrentModeIcon = currentModeMeta.icon
  const canActivatePrivateMode = (hasKey || Boolean(openaiKey.trim())) && (hasPrivateMongodb || Boolean(mongodbUrl.trim()))
  const privateActionLabel = hasKey && hasPrivateMongodb ? 'Activate private mode' : 'Save and activate private mode'

  const getModeCardClass = (cardMode) =>
    `soft-card relative p-5 text-left transition ${
      selectedMode === cardMode
        ? 'border border-teal-200 bg-teal-50/70 shadow-[0_24px_64px_-44px_rgba(15,118,110,0.45)]'
        : 'hover:border-slate-200 hover:bg-white/90'
    }`

  return (
    <div className="page-shell max-w-6xl py-8 sm:py-10">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="premium-card p-6 sm:p-8">
          <span className="eyebrow">Workspace controls</span>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">Settings</h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Manage keys, pick where data lives, and keep your workspace ready from one clean control surface.
              </p>
            </div>
            <div className="soft-card max-w-sm px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="icon-shell h-11 w-11 shrink-0">
                  <CurrentModeIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current mode</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{currentModeMeta.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{currentModeMeta.description}</p>
                </div>
              </div>
              <span className={`${currentModeMeta.pillClass} mt-4`}>{currentModeMeta.pillLabel}</span>
            </div>
          </div>
        </div>

        <div className="premium-card p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-12 w-12">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Usage</p>
              <h2 className="text-xl font-semibold text-slate-950">Last 30 days</h2>
            </div>
          </div>

          {usage ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {usageCards.map((item) => (
                <div key={item.label} className="soft-card p-4">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="soft-card mt-6 p-5 text-sm leading-7 text-slate-500">
              No usage data is available yet. Once you start uploading and chatting, your activity will appear here.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="premium-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-12 w-12">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Data mode</h2>
              <p className="text-sm text-slate-500">Choose whether your documents stay on the platform or in your own database.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={handleSwitchToPublic} disabled={saving} className={getModeCardClass('public')}>
              <div className="icon-shell h-12 w-12">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">Public mode</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Data is stored on the platform and usage is handled for you.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {mode === 'public' ? (
                  <span className="status-pill status-ready">Active</span>
                ) : selectedMode === 'public' ? (
                  <span className="soft-pill bg-white/80 text-slate-600">Selected</span>
                ) : null}
              </div>
            </button>

            <button type="button" onClick={handleSelectPrivate} disabled={saving} className={getModeCardClass('private')}>
              <div className="icon-shell h-12 w-12">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">Private mode</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Store documents and conversations in your own MongoDB with your OpenAI key.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {mode === 'private' ? (
                  <span className="status-pill status-ready">Active</span>
                ) : selectedMode === 'private' ? (
                  <span className="soft-pill bg-white/80 text-slate-600">Selected</span>
                ) : null}
              </div>
            </button>
          </div>

          {selectedMode === 'private' && mode !== 'private' && (
            <div className="soft-card mt-6 p-6 sm:p-7">
              <div className="flex items-start gap-3">
                <div className="icon-shell h-11 w-11 shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Set up private mode</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Private mode needs both your OpenAI key and your MongoDB database. Add what is missing here, then save once to activate it.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-[20px] border p-4 ${hasKey ? 'border-emerald-100 bg-emerald-50/90' : 'border-slate-200 bg-white/90'}`}>
                  <div className="flex items-center gap-2">
                    {hasKey ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    ) : (
                      <KeyRound className="h-4 w-4 text-slate-500" />
                    )}
                    <p className={`text-sm font-semibold ${hasKey ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {hasKey ? 'OpenAI key saved' : 'OpenAI key needed'}
                    </p>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${hasKey ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {hasKey
                      ? 'Your saved key is ready for private mode.'
                      : 'Private mode runs AI requests with your own OpenAI key.'}
                  </p>
                </div>

                <div
                  className={`rounded-[20px] border p-4 ${hasPrivateMongodb ? 'border-emerald-100 bg-emerald-50/90' : 'border-slate-200 bg-white/90'}`}
                >
                  <div className="flex items-center gap-2">
                    {hasPrivateMongodb ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    ) : (
                      <Database className="h-4 w-4 text-slate-500" />
                    )}
                    <p className={`text-sm font-semibold ${hasPrivateMongodb ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {hasPrivateMongodb ? 'MongoDB connected' : 'MongoDB needed'}
                    </p>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${hasPrivateMongodb ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {hasPrivateMongodb
                      ? 'Your private database is already configured.'
                      : 'New uploads and chats will be written to your own MongoDB database.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePrivateMode} className="mt-5 space-y-4">
                {!hasKey && (
                  <div>
                    <label className="field-label">OpenAI API key</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="field-input"
                    />
                  </div>
                )}

                {!hasPrivateMongodb && (
                  <>
                    <div>
                      <label className="field-label">MongoDB URL</label>
                      <input
                        type="password"
                        autoComplete="off"
                        value={mongodbUrl}
                        onChange={(e) => setMongodbUrl(e.target.value)}
                        placeholder="mongodb+srv://user:pass@cluster.mongodb.net/"
                        className="field-input"
                      />
                    </div>

                    <div>
                      <label className="field-label">Database name</label>
                      <input
                        type="text"
                        value={mongodbDbName}
                        onChange={(e) => setMongodbDbName(e.target.value)}
                        placeholder="pdf_gyan"
                        className="field-input"
                      />
                    </div>
                  </>
                )}

                <button type="submit" disabled={saving || !canActivatePrivateMode} className="btn-primary w-full justify-center">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  {privateActionLabel}
                </button>
              </form>

              <div className="mt-5 rounded-[20px] border border-amber-100 bg-amber-50/90 p-4 text-sm leading-6 text-amber-700">
                Switching to private mode starts fresh. Existing data stays on the platform while new uploads and chats go to your database.
              </div>
            </div>
          )}

          {selectedMode === 'private' && mode === 'private' && (
            <div className="mt-6 rounded-[22px] border border-emerald-100 bg-emerald-50/90 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                <p className="font-semibold text-emerald-700">Private mode is active</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-600">
                New documents and conversations now use your private MongoDB database and your saved OpenAI key.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-white/70 bg-white/85 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">OpenAI key</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">Saved and ready</p>
                </div>
                <div className="rounded-[20px] border border-white/70 bg-white/85 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">MongoDB</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">Connected for private storage</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
