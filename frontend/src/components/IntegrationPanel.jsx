import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://app.pdfgyan.com'

export default function IntegrationPanel({ documents = [] }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const [widgetType, setWidgetType] = useState('chat')
  const [ttlHours, setTtlHours] = useState(720)
  const [generatedToken, setGeneratedToken] = useState(null)
  const [docSearch, setDocSearch] = useState('')

  const readyDocs = documents.filter((doc) => doc.status === 'ready')
  const filteredDocs = docSearch
    ? readyDocs.filter(d => d.original_filename.toLowerCase().includes(docSearch.toLowerCase()))
    : readyDocs

  const toggleDoc = (id) => {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const fetchTokens = useCallback(async () => {
    setLoading(true)
    try { const res = await client.get('/api/embed/tokens'); setTokens(res.data || []) }
    catch { setTokens([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTokens() }, [fetchTokens])

  const activeTokens = tokens.filter((t) => t.is_active && !t.is_expired)
  const expiredTokens = tokens.filter((t) => !t.is_active || t.is_expired)

  const handleCreate = async (event) => {
    event.preventDefault()
    if (selectedDocs.size === 0) return
    setCreating(true)
    const docIds = Array.from(selectedDocs)
    try {
      const res = await client.post('/api/embed/tokens', { document_ids: docIds, widget_type: widgetType, ttl_hours: ttlHours })
      setGeneratedToken(res.data)
      await fetchTokens()
      toast.success('Widget token created')
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to create')
    }
    finally { setCreating(false) }
  }

  const handleRevoke = async (tokenId) => {
    if (!confirm('Revoke this widget token?')) return
    try { await client.delete(`/api/embed/tokens/${tokenId}`); setTokens((prev) => prev.filter((t) => t.id !== tokenId)); toast.success('Revoked') }
    catch { toast.error('Failed') }
  }

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied!') }
    catch { toast.error('Copy failed') }
  }

  const getSnippet = (token, type) => type === 'chat'
    ? `<script src="${APP_URL}/sdk/pgyan-chat-widget.js"></script>\n<script>\n  PGyanChat.init({ token: '${token}' });\n</script>`
    : `<script src="${APP_URL}/sdk/pgyan-call-widget.js"></script>\n<script>\n  PGyanCall.init({ token: '${token}' });\n</script>`

  const getDocName = (docId) => documents.find((d) => d.id === docId)?.original_filename || docId
  const getDocNames = (ids) => (ids || []).map(id => getDocName(id)).join(', ')

  const closeModal = () => { setShowCreate(false); setGeneratedToken(null); setSelectedDocs(new Set()); setWidgetType('chat'); setDocSearch('') }

  return (
    <div className="space-y-6">

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl flex items-center gap-3" style={{ color: 'var(--text)' }}>
          <Code2 className="h-5 w-5" style={{ color: '#6366f1' }} /> Your Widgets
        </h2>
        <div className="flex items-center gap-3">
          <div className="soft-card inline-flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{activeTokens.length} active</span>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary" disabled={readyDocs.length === 0}>
            <Plus className="h-4 w-4" /> New Widget
          </button>
        </div>
      </div>

      {/* ── Create / Result Modal ── */}
      {(showCreate || generatedToken) && (
        <div className="modal-overlay">
          <button type="button" className="modal-backdrop" onClick={closeModal} />
          <div className="premium-card modal-content w-full max-w-xl p-0 overflow-hidden">

            {/* Modal: Create Form */}
            {!generatedToken && (
              <>
                <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Create a widget</h3>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-soft)' }}>Pick a source, choose the type, and generate a token</p>
                  </div>
                  <button type="button" onClick={closeModal} className="btn-ghost !rounded-full !p-2">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="p-6 space-y-5">
                  {/* Source documents (multi-select) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-soft)' }}>
                        Source documents <span style={{ color: 'var(--teal)' }}>({selectedDocs.size} selected)</span>
                      </label>
                      {selectedDocs.size > 0 && (
                        <button type="button" onClick={() => setSelectedDocs(new Set())} className="text-[10px] font-semibold" style={{ color: 'var(--muted-soft)' }}>Clear</button>
                      )}
                    </div>
                    {readyDocs.length > 5 && (
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--muted-soft)' }} />
                        <input type="text" value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Filter sources..." className="field-input !text-[11px] !pl-7 !py-1.5" />
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto rounded-xl border p-1.5 space-y-0.5" style={{ borderColor: 'var(--border)' }}>
                      {filteredDocs.length === 0 ? (
                        <p className="p-2 text-xs text-center" style={{ color: 'var(--muted-soft)' }}>No sources match</p>
                      ) : filteredDocs.map(doc => {
                        const isSelected = selectedDocs.has(doc.id)
                        const isWebsite = doc.source_type === 'website'
                        return (
                          <button key={doc.id} type="button" onClick={() => toggleDoc(doc.id)}
                            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition"
                            style={{ background: isSelected ? 'var(--teal-soft)' : 'transparent' }}>
                            <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                              isSelected ? 'border-teal-500 bg-teal-600 text-white' : 'border-[var(--border)]'
                            }`}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {isWebsite ? <Globe className="h-3 w-3 shrink-0" style={{ color: '#f59e0b' }} /> : <FileText className="h-3 w-3 shrink-0" style={{ color: '#6366f1' }} />}
                              <span className="truncate text-xs font-medium" style={{ color: isSelected ? 'var(--teal)' : 'var(--text)' }}>{doc.original_filename}</span>
                            </div>
                            <span className="text-[9px] shrink-0" style={{ color: 'var(--muted-soft)' }}>
                              {isWebsite ? 'Website' : 'PDF'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Widget type */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5 block" style={{ color: 'var(--muted-soft)' }}>Widget type</label>
                    <div className="grid gap-3 grid-cols-2">
                      {[
                        { type: 'chat', icon: MessageSquare, label: 'Chat', desc: 'Text conversations', color: '#6366f1' },
                        { type: 'call', icon: Phone, label: 'Voice Call', desc: 'Spoken Q&A', color: '#10b981' },
                      ].map(w => (
                        <button key={w.type} type="button" onClick={() => setWidgetType(w.type)}
                          className="rounded-xl border p-4 text-left transition hover:-translate-y-0.5"
                          style={{
                            borderColor: widgetType === w.type ? w.color : 'var(--border)',
                            background: widgetType === w.type ? `${w.color}08` : 'var(--surface)',
                          }}>
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${w.color}15` }}>
                              <w.icon className="h-4 w-4" style={{ color: w.color }} />
                            </div>
                            <div>
                              <p className="text-sm font-bold" style={{ color: widgetType === w.type ? w.color : 'var(--text)' }}>{w.label}</p>
                              <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>{w.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* TTL */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5 block" style={{ color: 'var(--muted-soft)' }}>Token expires in</label>
                    <div className="flex gap-2">
                      {[
                        { value: 24, label: '24 hours' },
                        { value: 168, label: '7 days' },
                        { value: 720, label: '30 days' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => setTtlHours(opt.value)}
                          className="flex-1 rounded-xl border py-2.5 text-xs font-semibold transition"
                          style={{
                            borderColor: ttlHours === opt.value ? 'var(--teal)' : 'var(--border)',
                            background: ttlHours === opt.value ? 'var(--teal-soft)' : 'transparent',
                            color: ttlHours === opt.value ? 'var(--teal)' : 'var(--muted)',
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={creating || selectedDocs.size === 0} className="btn-primary w-full justify-center disabled:opacity-50">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Generate Widget Token
                  </button>
                </form>
              </>
            )}

            {/* Modal: Generated Token Result */}
            {generatedToken && (
              <>
                <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: '#10b98115' }}>
                    <Check className="h-5 w-5" style={{ color: '#10b981' }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Widget created!</h3>
                    <p className="text-xs truncate max-w-sm" style={{ color: 'var(--muted-soft)' }}>
                      {generatedToken.widget_type === 'chat' ? 'Chat' : 'Call'} widget · {generatedToken.document_ids?.length || 1} source{(generatedToken.document_ids?.length || 1) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button type="button" onClick={closeModal} className="btn-ghost !rounded-full !p-2">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Token */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-soft)' }}>Your token</label>
                      <button type="button" onClick={() => copyToClipboard(generatedToken.token)} className="btn-ghost text-[10px] !py-1 !px-2">
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <code className="block overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-xs text-emerald-400 leading-5">
                      {generatedToken.token}
                    </code>
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg p-2" style={{ background: '#f59e0b0d' }}>
                      <Shield className="h-3 w-3 shrink-0" style={{ color: '#d97706' }} />
                      <p className="text-[10px] font-medium" style={{ color: '#d97706' }}>Save this token now. It won't be shown in full again.</p>
                    </div>
                  </div>

                  {/* Embed snippet */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-soft)' }}>Embed code</label>
                      <button type="button" onClick={() => copyToClipboard(getSnippet(generatedToken.token, generatedToken.widget_type))} className="btn-ghost text-[10px] !py-1 !px-2">
                        <Copy className="h-3 w-3" /> Copy snippet
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-slate-300 font-mono">
                      {getSnippet(generatedToken.token, generatedToken.widget_type)}
                    </pre>
                    <p className="mt-2 text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                      Paste this before the closing <code className="font-mono">&lt;/body&gt;</code> tag on your website.
                    </p>
                  </div>

                  <button type="button" onClick={closeModal} className="btn-primary w-full justify-center">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── No sources message ── */}
      {readyDocs.length === 0 && (
        <div className="premium-card flex flex-col items-center justify-center p-8 text-center">
          <Globe className="h-8 w-8" style={{ color: 'var(--muted-soft)' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--muted)' }}>No ready sources yet</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted-soft)' }}>Upload a PDF or crawl a website first, then create embed widgets here.</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="premium-card flex min-h-[8rem] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--teal)' }} />
        </div>
      )}

      {/* ── Active Widgets ── */}
      {!loading && activeTokens.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: '#10b98115', color: '#10b981' }}>
              <Check className="h-3 w-3" />
            </span>
            Active widgets
          </h3>

          <div className="grid gap-3 md:grid-cols-2">
            {activeTokens.map((token) => {
              const isChat = token.widget_type === 'chat'
              const color = isChat ? '#6366f1' : '#10b981'
              return (
                <div key={token.id} className="premium-card overflow-hidden">
                  <div className="h-1 w-full" style={{ background: color }} />
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}15` }}>
                        {isChat ? <MessageSquare className="h-4 w-4" style={{ color }} /> : <Phone className="h-4 w-4" style={{ color }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                          {isChat ? 'Chat Widget' : 'Call Widget'}
                        </p>
                        <p className="truncate text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {token.document_ids?.length > 1
                            ? `${token.document_ids.length} sources`
                            : getDocName(token.document_id)}
                        </p>
                      </div>
                      <button type="button" onClick={() => handleRevoke(token.id)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: `${color}12`, color }}>
                        {token.usage_count} uses
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                        <code className="font-mono">{token.token_prefix}...</code>
                      </span>
                      {token.expires_at && (
                        <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                          Expires {new Date(token.expires_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Expired / Revoked ── */}
      {!loading && expiredTokens.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold" style={{ color: 'var(--muted-soft)' }}>Expired / Revoked</h3>
          {expiredTokens.slice(0, 5).map((token) => (
            <div key={token.id} className="soft-card flex items-center gap-3 p-3 opacity-60">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--surface-soft)' }}>
                {token.widget_type === 'chat' ? <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--muted-soft)' }} /> : <Phone className="h-3.5 w-3.5" style={{ color: 'var(--muted-soft)' }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {token.widget_type === 'chat' ? 'Chat' : 'Call'} · {getDocName(token.document_id)}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                  <code className="font-mono">{token.token_prefix}...</code> · {token.is_active ? 'Expired' : 'Revoked'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && tokens.length === 0 && !showCreate && !generatedToken && readyDocs.length > 0 && (
        <div className="premium-card flex flex-col items-center justify-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: '#6366f110' }}>
            <Code2 className="h-6 w-6" style={{ color: '#6366f1' }} />
          </div>
          <p className="mt-4 text-sm font-bold" style={{ color: 'var(--text)' }}>No widgets yet</p>
          <p className="mt-1.5 max-w-xs text-xs leading-5" style={{ color: 'var(--muted)' }}>
            Click <b>New Widget</b> to create your first chat or call embed for your website.
          </p>
        </div>
      )}
    </div>
  )
}
