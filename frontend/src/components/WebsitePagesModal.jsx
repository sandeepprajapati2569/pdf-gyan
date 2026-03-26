import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Check, CheckSquare, ChevronLeft, ChevronRight, Download,
  ExternalLink, FileText, Filter, Globe, Loader2, Plus, RefreshCw,
  Search, Square, X, Zap,
} from 'lucide-react'
import { getWebsitePages, updateWebsitePages, addWebsitePage, indexWebsite, crawlMorePages, bulkUpdatePages } from '../api/websites'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  crawled: { label: 'Crawled', icon: Check, color: 'var(--teal)', bg: 'var(--teal-soft)' },
  discovered: { label: 'Discovered', icon: Download, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  failed: { label: 'Failed', icon: AlertTriangle, color: 'var(--danger)', bg: 'rgba(194,65,12,0.08)' },
}

export default function WebsitePagesModal({ docId, docName, onClose, onIndexed }) {
  const [pages, setPages] = useState([])
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ crawled: 0, discovered: 0, failed: 0, included: 0 })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [crawlingMore, setCrawlingMore] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const [page, setPage] = useState(1)
  const [perPage] = useState(50)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState(null)

  const [pendingChanges, setPendingChanges] = useState({})
  const searchTimeout = useRef(null)

  const loadPages = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: perPage }
      if (statusFilter) params.status = statusFilter
      if (categoryFilter) params.category = categoryFilter
      if (search.trim()) params.search = search.trim()
      const res = await getWebsitePages(docId, params)
      const data = res.data
      setPages(data.pages || [])
      setTotalPages(data.total_pages || 1)
      setStats(data.stats || { crawled: 0, discovered: 0, failed: 0, included: 0 })
      setCategories(data.categories || [])
    } catch { toast.error('Failed to load pages') }
    finally { setLoading(false) }
  }, [docId, page, perPage, statusFilter, categoryFilter, search])

  useEffect(() => { loadPages() }, [loadPages])

  const handleSearchChange = (val) => {
    setSearch(val); setPage(1)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => loadPages(), 300)
  }

  const togglePage = (url, currentIncluded) => {
    setPendingChanges(prev => ({ ...prev, [url]: !currentIncluded }))
  }

  const isIncluded = (p) => p.url in pendingChanges ? pendingChanges[p.url] : p.included
  const hasPendingChanges = Object.keys(pendingChanges).length > 0

  const handleSave = async () => {
    if (!hasPendingChanges) return
    setSaving(true)
    try {
      await updateWebsitePages(docId, Object.entries(pendingChanges).map(([url, included]) => ({ url, included })))
      setPendingChanges({}); toast.success('Saved'); loadPages()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleIndex = async () => {
    setIndexing(true)
    try {
      if (hasPendingChanges) {
        await updateWebsitePages(docId, Object.entries(pendingChanges).map(([url, included]) => ({ url, included })))
        setPendingChanges({})
      }
      await indexWebsite(docId); toast.success('Indexing started!'); onIndexed?.(); onClose()
    } catch (err) { toast.error(err.response?.data?.detail || 'Indexing failed') }
    finally { setIndexing(false) }
  }

  const handleAddUrl = async (e) => {
    e.preventDefault(); if (!addUrl.trim()) return
    setAdding(true)
    try { await addWebsitePage(docId, addUrl.trim()); setAddUrl(''); setShowAdd(false); toast.success('Page added!'); loadPages() }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setAdding(false) }
  }

  const handleCrawlMore = async (cat = null) => {
    setCrawlingMore(true)
    try {
      const res = await crawlMorePages(docId, 50, cat)
      toast.success(res.data.message || 'Crawling...')
      setTimeout(() => { loadPages(); setCrawlingMore(false) }, 5000)
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); setCrawlingMore(false) }
  }

  const handleBulkAction = async (action) => {
    try {
      const res = await bulkUpdatePages(docId, action, categoryFilter, statusFilter)
      toast.success(`${res.data.updated} pages ${action}d`); loadPages()
    } catch { toast.error('Failed') }
  }

  const totalAll = stats.crawled + stats.discovered + stats.failed

  return (
    <div className="modal-overlay">
      <button type="button" className="modal-backdrop" onClick={onClose} />

      <div className="premium-card modal-content flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: '#f59e0b15' }}>
                <Globe className="h-5 w-5" style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{docName}</h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-soft)' }}>Manage crawled pages, select what to index, and crawl more.</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost !rounded-full !p-2 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Crawled', value: stats.crawled, color: 'var(--teal)' },
              { label: 'Discovered', value: stats.discovered, color: '#6366f1' },
              { label: 'Included', value: stats.included, color: '#10b981' },
              { label: 'Failed', value: stats.failed, color: 'var(--danger)' },
            ].map(s => (
              <div key={s.label} className="soft-card flex items-center gap-2 p-3">
                <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--muted-soft)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Crawl more banner */}
          {stats.discovered > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: '#6366f10d', border: '1px solid #6366f120' }}>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: '#6366f1' }} />
                <span className="text-xs font-semibold" style={{ color: '#6366f1' }}>
                  {stats.discovered} pages discovered but not yet crawled
                </span>
              </div>
              <button type="button" onClick={() => handleCrawlMore()} disabled={crawlingMore}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition"
                style={{ background: '#6366f1' }}>
                {crawlingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Crawl Next 50
              </button>
            </div>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="border-b px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: null, label: 'All', count: totalAll },
              { key: 'crawled', label: 'Crawled', count: stats.crawled },
              { key: 'discovered', label: 'Discovered', count: stats.discovered },
              { key: 'failed', label: 'Failed', count: stats.failed },
            ].map(tab => (
              <button key={tab.key || 'all'} type="button"
                onClick={() => { setStatusFilter(tab.key); setPage(1) }}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                  statusFilter === tab.key ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--border)] text-[var(--muted-soft)] hover:text-[var(--muted)]'
                }`}>
                {tab.label} <span className="ml-0.5 opacity-60">{tab.count}</span>
              </button>
            ))}

            {/* Bulk actions */}
            <span className="mx-1 h-4 w-px" style={{ background: 'var(--border)' }} />
            <button type="button" onClick={() => handleBulkAction('include')} className="text-[10px] font-semibold transition" style={{ color: 'var(--teal)' }} title="Include all visible">
              <CheckSquare className="inline h-3 w-3 mr-0.5" /> All
            </button>
            <button type="button" onClick={() => handleBulkAction('exclude')} className="text-[10px] font-semibold transition" style={{ color: 'var(--muted-soft)' }} title="Exclude all visible">
              <Square className="inline h-3 w-3 mr-0.5" /> None
            </button>
          </div>

          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--muted-soft)' }} />
            <input type="text" value={search} onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search URLs or titles..." className="field-input !pl-9 !py-1.5 !text-xs w-56" />
          </div>
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="border-b px-6 py-2 flex items-center gap-1.5 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            <Filter className="h-3 w-3 shrink-0" style={{ color: 'var(--muted-soft)' }} />
            <button type="button" onClick={() => { setCategoryFilter(null); setPage(1) }}
              className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition ${
                !categoryFilter ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--border)] text-[var(--muted-soft)]'
              }`}>All</button>
            {categories.map(cat => (
              <button key={cat.pattern} type="button"
                onClick={() => { setCategoryFilter(cat.label.toLowerCase()); setPage(1) }}
                className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition ${
                  categoryFilter === cat.label.toLowerCase() ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--border)] text-[var(--muted-soft)]'
                }`}>{cat.label} ({cat.count})</button>
            ))}
          </div>
        )}

        {/* ── Page List ── */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--teal)' }} />
              <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>Loading pages...</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Globe className="h-10 w-10" style={{ color: 'var(--muted-soft)' }} />
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--muted)' }}>No pages match your filters</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted-soft)' }}>Try changing the status or category filter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map(p => {
                const included = isIncluded(p)
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.crawled
                const StatusIcon = cfg.icon
                const isCrawled = p.status === 'crawled'

                return (
                  <div key={p.url || p.id}
                    className="group flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm"
                    style={{ borderColor: included && isCrawled ? 'var(--teal-soft)' : 'var(--border)', background: included && isCrawled ? 'rgba(15,118,110,0.03)' : 'var(--surface)' }}>

                    {/* Checkbox / Status icon */}
                    {isCrawled ? (
                      <button type="button" onClick={() => togglePage(p.url, included)}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition ${
                          included ? 'border-teal-500 bg-teal-600 text-white' : 'border-[var(--border)] text-[var(--border)] hover:border-slate-300'
                        }`}>
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: cfg.bg }}>
                        <StatusIcon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold" style={{ color: 'var(--text)' }}>
                          {p.title || (p.status === 'discovered' ? 'Awaiting crawl' : 'Untitled')}
                        </p>
                        {p.status !== 'crawled' && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="truncate text-[10px]" style={{ color: 'var(--muted-soft)' }}>{p.url}</p>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="shrink-0 opacity-0 group-hover:opacity-60 transition">
                          <ExternalLink className="h-2.5 w-2.5" style={{ color: 'var(--muted-soft)' }} />
                        </a>
                      </div>
                      {p.status === 'failed' && p.error && (
                        <p className="mt-0.5 text-[10px]" style={{ color: 'var(--danger)' }}>{p.error}</p>
                      )}
                    </div>

                    {/* Meta badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {p.category && (
                        <span className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
                          {p.category}
                        </span>
                      )}
                      {isCrawled && p.char_count > 0 && (
                        <span className="rounded-md px-1.5 py-0.5 text-[9px] font-medium" style={{ background: 'var(--surface-soft)', color: 'var(--muted-soft)' }}>
                          {p.char_count > 1000 ? `${(p.char_count / 1000).toFixed(1)}k` : p.char_count} chars
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="border-t px-6 py-2 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, totalAll)} of {totalAll}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="btn-ghost !rounded-lg !p-1 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                {page} <span style={{ color: 'var(--muted-soft)' }}>/ {totalPages}</span>
              </span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="btn-ghost !rounded-lg !p-1 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="border-t px-6 py-4 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-soft)' }}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowAdd(!showAdd)} className="btn-ghost text-xs">
              <Plus className="h-3.5 w-3.5" /> Add URL
            </button>
            {categoryFilter && stats.discovered > 0 && (
              <button type="button" onClick={() => handleCrawlMore(categoryFilter)} disabled={crawlingMore} className="btn-ghost text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Crawl {categoryFilter}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasPendingChanges && (
              <button type="button" onClick={handleSave} disabled={saving} className="btn-ghost text-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </button>
            )}
            <button type="button" onClick={handleIndex} disabled={indexing || stats.included === 0} className="btn-primary text-sm">
              {indexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4" /> Index {stats.included} Pages</>}
            </button>
          </div>
        </div>

        {/* ── Add URL ── */}
        {showAdd && (
          <div className="border-t px-6 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <form onSubmit={handleAddUrl} className="flex items-center gap-3">
              <Globe className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-soft)' }} />
              <input type="url" value={addUrl} onChange={e => setAddUrl(e.target.value)}
                placeholder="https://example.com/new-page" className="field-input flex-1 !text-xs" required />
              <button type="submit" disabled={adding} className="btn-primary text-xs !py-2">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add & Crawl'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost !rounded-full !p-1.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
