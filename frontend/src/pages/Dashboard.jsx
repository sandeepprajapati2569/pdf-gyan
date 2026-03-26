import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  AlertTriangle, BarChart3, Check, CheckCircle2, ChevronRight, Clock3, Eye,
  FileText, Files, FolderKanban, Globe, Loader2, MessageSquareText,
  Phone, Plus, RefreshCw, Settings2, Trash2, UploadCloud, X,
} from 'lucide-react'
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents'
import { crawlWebsite } from '../api/websites'
import client from '../api/client'
import { useAuth } from '../context/useAuth'
import { useCrawlProgress } from '../hooks/useCrawlProgress'
import WebsitePagesModal from '../components/WebsitePagesModal'
import FilePreviewModal from '../components/workspace/FilePreviewModal'
import ShortcutsModal from '../components/ShortcutsModal'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import toast from 'react-hot-toast'

function FaviconIcon({ url, favicon }) {
  const [failed, setFailed] = useState(false)

  // Build favicon URL: use stored favicon, or derive from Google service
  const src = !failed && (favicon || (url ? `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64` : null))

  if (!src || failed) {
    return <Globe className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} />
  }

  return (
    <img
      src={src}
      alt=""
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  )
}

const statusConfig = {
  processing: { icon: Clock3, label: 'Processing', chipClass: 'status-pill status-processing', accent: 'text-amber-700' },
  crawled:    { icon: CheckCircle2, label: 'Crawled', chipClass: 'status-pill status-processing', accent: 'text-amber-700' },
  ready:      { icon: CheckCircle2, label: 'Ready to chat', chipClass: 'status-pill status-ready', accent: 'text-emerald-700' },
  failed:     { icon: AlertTriangle, label: 'Needs attention', chipClass: 'status-pill status-failed', accent: 'text-red-700' },
}

const dateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Dashboard() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlingDocId, setCrawlingDocId] = useState(null)
  const [pagesModalDoc, setPagesModalDoc] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null) // {id, name, page_count}
  const [showAddSource, setShowAddSource] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  // Keyboard shortcuts
  const fileInputRef = document.querySelector('input[type="file"]')
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    onUpload: () => fileInputRef?.click(),
  })

  // Real-time crawl progress
  const crawlProgress = useCrawlProgress(crawlingDocId, !!crawlingDocId)

  const fetchDocs = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true)
    try {
      const res = await getDocuments()
      setDocuments(res.data)
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocs({ showLoader: true })
    const interval = setInterval(() => fetchDocs(), 5000)
    return () => clearInterval(interval)
  }, [fetchDocs])

  // Clear crawling state when progress completes
  useEffect(() => {
    if (crawlProgress.isComplete) {
      setTimeout(() => {
        setCrawlingDocId(null)
        crawlProgress.reset()
        fetchDocs()
      }, 1500)
    }
  }, [crawlProgress.isComplete, fetchDocs, crawlProgress])

  // ─── Handlers ──────────────────────────────────────

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are allowed')
      return
    }
    setUploading(true)
    try {
      await uploadDocument(file)
      toast.success('Document uploaded! Indexing has started.')
      fetchDocs()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [fetchDocs])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  const handleCrawlWebsite = async (e) => {
    e.preventDefault()
    const url = websiteUrl.trim()
    if (!url) return
    setCrawling(true)
    try {
      const res = await crawlWebsite({ url })
      const docId = res.data.id
      setCrawlingDocId(docId)
      setWebsiteUrl('')
      toast.success('Crawl started!')
      fetchDocs()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start crawl')
    } finally {
      setCrawling(false)
    }
  }

  const handleDelete = async (id, event) => {
    event.stopPropagation()
    if (!confirm('Delete this and all its conversations?')) return
    try {
      await deleteDocument(id)
      toast.success('Deleted')
      setDocuments(prev => prev.filter(d => d.id !== id))
      setSelectedDocs(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch { toast.error('Failed to delete') }
  }

  const toggleSelect = (id, event) => {
    event.stopPropagation()
    setSelectedDocs(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const handleScheduleChange = async (docId, schedule) => {
    try {
      await client.put(`/api/websites/${docId}/schedule`, { schedule })
      toast.success(schedule ? `Re-crawl set to ${schedule}` : 'Auto re-crawl disabled')
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, recrawl_schedule: schedule } : d))
    } catch { toast.error('Failed to update schedule') }
  }

  const handleMultiChat = () => navigate(`/chat/multi?docs=${Array.from(selectedDocs).join(',')}&compare=true`)

  // Tags & filtering
  const [activeTag, setActiveTag] = useState(null)
  const allTags = [...new Set(documents.flatMap(d => d.tags || []))]

  // Split documents
  const pdfDocsAll = documents.filter(d => d.source_type !== 'website')
  const websiteDocsAll = documents.filter(d => d.source_type === 'website')
  const pdfDocs = activeTag ? pdfDocsAll.filter(d => (d.tags || []).includes(activeTag)) : pdfDocsAll
  const websiteDocs = activeTag ? websiteDocsAll.filter(d => (d.tags || []).includes(activeTag)) : websiteDocsAll
  const readyCount = documents.filter(d => d.status === 'ready').length
  const selectedCount = selectedDocs.size
  const totalSources = pdfDocsAll.length + websiteDocsAll.length

  return (
    <div className="page-shell max-w-7xl py-8 sm:py-10">

      {/* ─── Header + Stats ──────────────────────────── */}
      <section className="premium-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">Documents</h1>
            <p className="mt-2 max-w-xl text-base leading-7 text-slate-600">
              Upload PDFs or crawl websites, then chat, call, or embed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddSource(true)}
            className="btn-primary shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Source
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: totalSources, color: 'var(--teal)' },
            { label: 'Ready', value: readyCount, color: '#10b981' },
            { label: 'PDFs', value: pdfDocsAll.length, color: '#6366f1' },
            { label: 'Websites', value: websiteDocsAll.length, color: '#f59e0b' },
          ].map(item => (
            <div key={item.label} className="soft-card flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${item.color}15` }}>
                <span className="text-lg font-bold" style={{ color: item.color }}>{item.value}</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Add Source Modal ──────────────────────────── */}
      {showAddSource && (
        <div className="modal-overlay">
          <button type="button" className="modal-backdrop" onClick={() => setShowAddSource(false)} />
          <div className="premium-card modal-content w-full max-w-2xl p-0 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl" style={{ color: 'var(--text)' }}>Add a new source</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted-soft)' }}>Choose how you want to bring knowledge into your workspace</p>
                </div>
                <button type="button" onClick={() => setShowAddSource(false)} className="btn-ghost !rounded-full !p-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              {/* PDF Upload */}
              <div
                {...getRootProps()}
                className={`group rounded-2xl border p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${
                  isDragActive ? 'border-teal-400 bg-teal-50/60 shadow-lg' : 'border-[var(--border)] hover:border-teal-300'
                }`}
                style={{ background: isDragActive ? undefined : 'var(--surface)' }}
              >
                <input {...getInputProps()} />
                <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: '#6366f115' }}>
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#6366f1' }} /> : <UploadCloud className="h-5 w-5" style={{ color: '#6366f1' }} />}
                </div>
                <h3 className="mt-4 text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {uploading ? 'Uploading...' : isDragActive ? 'Drop your PDF here' : 'Upload a PDF'}
                </h3>
                <p className="mt-1.5 text-xs leading-5" style={{ color: 'var(--muted)' }}>
                  Drag and drop or click to browse. Supports files up to 50 MB. Indexing starts automatically.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {['Auto-indexed', 'Chat ready', 'Voice call'].map(tag => (
                    <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: '#6366f112', color: '#6366f1' }}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Website Crawl */}
              <div className="rounded-2xl border p-6 transition-all" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: '#f59e0b15' }}>
                  <Globe className="h-5 w-5" style={{ color: '#f59e0b' }} />
                </div>
                <h3 className="mt-4 text-sm font-bold" style={{ color: 'var(--text)' }}>Crawl a website</h3>
                <p className="mt-1.5 text-xs leading-5" style={{ color: 'var(--muted)' }}>
                  Enter a URL to crawl up to 2000 pages. We extract text and build a searchable index.
                </p>
                <form onSubmit={(e) => { handleCrawlWebsite(e); setShowAddSource(false) }} className="mt-4">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--muted-soft)' }} />
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://docs.example.com"
                      required
                      className="field-input !rounded-xl !pl-9 !text-xs"
                    />
                  </div>
                  <button type="submit" disabled={crawling || !websiteUrl.trim()} className="btn-primary mt-3 w-full justify-center text-xs">
                    {crawling ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting...</> : <><Globe className="h-3.5 w-3.5" /> Start Crawl</>}
                  </button>
                </form>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Auto-categorized', 'Incremental crawl', 'Re-crawl schedule'].map(tag => (
                    <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: '#f59e0b12', color: '#d97706' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Crawl Progress (shown inline when active) ── */}
      {crawlingDocId && !crawlProgress.isComplete && (
        <section className="mt-6">
          <div className="premium-card overflow-hidden p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Crawling in progress</p>
                <h2 className="font-display mt-1 text-xl text-slate-950">Website crawl</h2>
              </div>
              <div className="icon-shell h-12 w-12">
                <Globe className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-teal-200/60 bg-teal-50/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
                <p className="text-sm font-semibold text-teal-800">
                  {crawlProgress.phase === 'sitemap' ? 'Discovering pages from sitemap...' :
                   crawlProgress.phase === 'bfs' ? 'Discovering pages via links...' :
                   crawlProgress.currentUrl ? 'Crawling pages...' : 'Starting crawl...'}
                </p>
              </div>
              {crawlProgress.totalUrls > 0 && (
                <>
                  <div className="w-full bg-teal-100 rounded-full h-2 mb-2">
                    <div className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (crawlProgress.pageNum / crawlProgress.totalUrls) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-teal-700 mb-2">
                    {crawlProgress.pageNum} / {crawlProgress.totalUrls} pages
                    {crawlProgress.pages.length > 0 && ` · ${crawlProgress.pages.length} extracted`}
                  </p>
                </>
              )}
              {crawlProgress.pages.length > 0 && (
                <div className="mt-3 max-h-28 overflow-y-auto space-y-1">
                  {crawlProgress.pages.slice(-5).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="h-3 w-3 text-teal-600 shrink-0" />
                      <span className="truncate">{p.title || p.url}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── Tag Filter Bar ─────────────────────── */}
      {allTags.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-soft)' }}>Filter</span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              !activeTag ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeTag === tag ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--teal-soft)]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ─── Websites Section (on top) ────────────────── */}
      <section id="web-library" className="mt-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-slate-950 flex items-center gap-3">
              <Globe className="h-6 w-6" style={{ color: '#f59e0b' }} /> Websites
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              Crawled sources ready for chat, voice, and embedding.
            </p>
          </div>
          <div className="soft-card inline-flex items-center gap-2 px-3 py-2">
            <Globe className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{websiteDocs.length} website{websiteDocs.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {loading ? (
          <div className="premium-card flex min-h-[12rem] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : websiteDocs.length === 0 ? (
          <div className="premium-card flex min-h-[10rem] flex-col items-center justify-center px-6 text-center">
            <Globe className="h-8 w-8" style={{ color: 'var(--muted-soft)' }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>No websites yet. Click <b>Add Source</b> to crawl one.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {websiteDocs.map((doc, index) => (
              <WebsiteCard
                key={doc.id}
                doc={doc}
                index={index}
                isSelected={selectedDocs.has(doc.id)}
                onToggleSelect={toggleSelect}
                onDelete={handleDelete}
                onNavigate={(id) => navigate(`/chat/${id}`)}
                onCall={(id) => navigate(`/call/${id}`)}
                onManagePages={(doc) => setPagesModalDoc(doc)}
                onScheduleChange={handleScheduleChange}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── PDF Documents Section ───────────────────── */}
      <section id="documents-library" className="mt-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-slate-950 flex items-center gap-3">
              <FileText className="h-6 w-6" style={{ color: '#6366f1' }} /> PDF Documents
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              Uploaded PDFs ready for chat, voice, and comparison.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="soft-card inline-flex items-center gap-2 px-3 py-2">
              <FileText className="h-3.5 w-3.5" style={{ color: '#6366f1' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{pdfDocs.length} document{pdfDocs.length !== 1 ? 's' : ''}</span>
            </div>
            {selectedCount > 0 && (
              <div className="soft-card inline-flex items-center gap-2 px-3 py-2">
                <Check className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{selectedCount} selected</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="premium-card flex min-h-[12rem] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : pdfDocs.length === 0 ? (
          <div className="premium-card flex min-h-[10rem] flex-col items-center justify-center px-6 text-center">
            <FileText className="h-8 w-8" style={{ color: 'var(--muted-soft)' }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>No documents yet. Click <b>Add Source</b> to upload a PDF.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pdfDocs.map((doc, index) => (
              <DocCard
                key={doc.id}
                doc={doc}
                index={index}
                isSelected={selectedDocs.has(doc.id)}
                onToggleSelect={toggleSelect}
                onDelete={handleDelete}
                onNavigate={(id) => navigate(`/chat/${id}`)}
                onCall={(id) => navigate(`/call/${id}`)}
                onPreview={(d) => setPreviewDoc({ id: d.id, name: d.original_filename, page_count: d.page_count })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Multi-select Bar ────────────────────────── */}
      {selectedCount >= 2 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 px-4">
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-[rgba(15,23,42,0.92)] px-5 py-4 text-white shadow-[0_28px_60px_rgba(15,23,42,0.28)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
                <Files className="h-5 w-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedCount} selected</p>
                <p className="text-sm text-slate-300">Compare across sources.</p>
              </div>
            </div>
            <button type="button" onClick={handleMultiChat} className="btn-primary shrink-0">
              <Files className="h-4 w-4" /> Compare now
            </button>
          </div>
        </div>
      )}

      {/* ─── Pages Modal ─────────────────────────────── */}
      {previewDoc && (
        <FilePreviewModal
          fileId={previewDoc.id}
          fileName={previewDoc.name}
          fileType="pdf"
          pageCount={previewDoc.page_count}
          source="document"
          onClose={() => setPreviewDoc(null)}
          onChat={() => { setPreviewDoc(null); navigate(`/chat/${previewDoc.id}`) }}
        />
      )}

      {pagesModalDoc && (
        <WebsitePagesModal
          docId={pagesModalDoc.id}
          docName={pagesModalDoc.original_filename}
          sourceUrl={pagesModalDoc.source_url}
          faviconUrl={pagesModalDoc.favicon_url}
          onClose={() => setPagesModalDoc(null)}
          onIndexed={fetchDocs}
        />
      )}

      {showHelp && <ShortcutsModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}


/* ─── PDF Document Card ────────────────────────────────── */
function DocCard({ doc, index, isSelected, onToggleSelect, onDelete, onNavigate, onCall, onPreview }) {
  const status = statusConfig[doc.status] || statusConfig.processing
  const StatusIcon = status.icon
  const isReady = doc.status === 'ready'

  return (
    <article
      onClick={() => isReady && onPreview?.(doc)}
      className={`premium-card animate-rise group overflow-hidden transition-all ${
        isReady ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-strong)]' : 'cursor-default'
      } ${isSelected ? 'border-teal-300/90 shadow-[0_24px_60px_rgba(15,118,110,0.14)]' : ''}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top color accent bar */}
      <div className="h-1 w-full" style={{ background: isReady ? 'linear-gradient(90deg, var(--teal), var(--teal-strong))' : doc.status === 'failed' ? 'var(--danger)' : 'var(--amber)' }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {isReady && (
            <button type="button" onClick={(e) => onToggleSelect(doc.id, e)}
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl border transition ${
                isSelected ? 'border-teal-500 bg-teal-600 text-white' : 'border-[var(--border)] text-transparent group-hover:text-slate-300'
              }`}>
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{doc.original_filename}</p>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={status.chipClass} style={{ fontSize: '10px' }}><StatusIcon className={`h-3 w-3 ${status.accent}`} />{status.label}</span>
              {doc.page_count > 0 && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--muted-soft)' }}>{doc.page_count} pages</span>
              )}
              {doc.auto_summary && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--teal)' }}>AI summary</span>
              )}
            </div>
          </div>
          <button type="button" onClick={(e) => onDelete(doc.id, e)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Summary preview */}
        {doc.auto_summary && (
          <p className="mt-3 line-clamp-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>{doc.auto_summary}</p>
        )}

        {/* Date */}
        <p className="mt-3 text-[10px]" style={{ color: 'var(--muted-soft)' }}>{dateFormatter.format(new Date(doc.created_at))}</p>

        {/* Actions */}
        {isReady && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onPreview?.(doc) }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-slate-50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              <Eye className="h-3 w-3" /> View
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onNavigate(doc.id) }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-[var(--teal-soft)]"
              style={{ borderColor: 'var(--border)', color: 'var(--teal)' }}>
              <MessageSquareText className="h-3 w-3" /> Chat
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onCall(doc.id) }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-emerald-50"
              style={{ borderColor: 'var(--border)', color: '#10b981' }}>
              <Phone className="h-3 w-3" /> Call
            </button>
          </div>
        )}

        {doc.error_message && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50/80 p-3">
            <p className="text-[11px] leading-5 text-red-600">{doc.error_message}</p>
          </div>
        )}
      </div>
    </article>
  )
}


/* ─── Website Card ─────────────────────────────────────── */
function WebsiteCard({ doc, index, isSelected, onToggleSelect, onDelete, onNavigate, onCall, onManagePages, onScheduleChange }) {
  const status = statusConfig[doc.status] || statusConfig.processing
  const StatusIcon = status.icon
  const isReady = doc.status === 'ready'
  const isCrawled = doc.status === 'crawled'

  const statusLabel = doc.status === 'processing' ? 'Crawling...'
    : isCrawled ? `${doc.page_count || 0} pages crawled`
    : status.label

  const barColor = isReady ? 'linear-gradient(90deg, #f59e0b, #d97706)' : isCrawled ? 'linear-gradient(90deg, var(--teal), var(--teal-strong))' : doc.status === 'failed' ? 'var(--danger)' : 'var(--amber)'

  return (
    <article
      onClick={() => isReady && onNavigate(doc.id)}
      className={`premium-card animate-rise group overflow-hidden transition-all ${
        isReady ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-strong)]' : 'cursor-default'
      } ${isSelected ? 'border-teal-300/90 shadow-[0_24px_60px_rgba(15,118,110,0.14)]' : ''}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top accent */}
      <div className="h-1 w-full" style={{ background: barColor }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          {isReady && (
            <button type="button" onClick={(e) => onToggleSelect(doc.id, e)}
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl border transition ${
                isSelected ? 'border-teal-500 bg-teal-600 text-white' : 'border-[var(--border)] text-transparent group-hover:text-slate-300'
              }`}>
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FaviconIcon url={doc.source_url} favicon={doc.favicon_url} />
              <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{doc.original_filename}</p>
            </div>
            {doc.source_url && (
              <p className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--muted-soft)' }}>{doc.source_url}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={isCrawled ? 'status-pill status-processing' : status.chipClass} style={{ fontSize: '10px' }}>
                <StatusIcon className={`h-3 w-3 ${isCrawled ? 'text-amber-700' : status.accent}`} />
                {statusLabel}
              </span>
              {doc.recrawl_schedule && (
                <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: 'var(--muted-soft)' }}>
                  <RefreshCw className="h-2.5 w-2.5" /> {doc.recrawl_schedule}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={(e) => onDelete(doc.id, e)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Summary or URL info */}
        {doc.auto_summary ? (
          <p className="mt-3 line-clamp-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>{doc.auto_summary}</p>
        ) : doc.page_count > 0 ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
            {doc.page_count} pages indexed{doc.crawl_stats?.total_discovered ? ` · ${doc.crawl_stats.total_discovered} discovered` : ''}
          </p>
        ) : null}

        {/* Date + schedule */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>{dateFormatter.format(new Date(doc.created_at))}</p>
          {isReady && (
            <select
              value={doc.recrawl_schedule || ''}
              onChange={(e) => { e.stopPropagation(); onScheduleChange(doc.id, e.target.value || null) }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border px-2 py-0.5 text-[10px] font-medium outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface)' }}
            >
              <option value="">No re-crawl</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {(isCrawled || isReady) && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onManagePages(doc) }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-slate-50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              <Settings2 className="h-3 w-3" /> {isCrawled ? 'Review & Index' : 'Pages'}
            </button>
          )}
          {isReady && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); onNavigate(doc.id) }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-[var(--teal-soft)]"
                style={{ borderColor: 'var(--border)', color: 'var(--teal)' }}>
                <MessageSquareText className="h-3 w-3" /> Chat
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onCall(doc.id) }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-emerald-50"
                style={{ borderColor: 'var(--border)', color: '#10b981' }}>
                <Phone className="h-3 w-3" /> Call
              </button>
            </>
          )}
          {doc.status === 'processing' && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium" style={{ color: 'var(--muted-soft)' }}>
              <Loader2 className="h-3 w-3 animate-spin" /> Crawling...
            </div>
          )}
        </div>

        {doc.error_message && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50/80 p-3">
            <p className="text-[11px] leading-5 text-red-600">{doc.error_message}</p>
          </div>
        )}
      </div>
    </article>
  )
}
