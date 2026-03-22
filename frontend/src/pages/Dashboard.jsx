import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Files,
  FolderKanban,
  Loader2,
  MessageSquareText,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents'
import { useAuth } from '../context/useAuth'
import toast from 'react-hot-toast'

const statusConfig = {
  processing: {
    icon: Clock3,
    label: 'Indexing',
    chipClass: 'status-pill status-processing',
    accent: 'text-amber-700',
  },
  ready: {
    icon: CheckCircle2,
    label: 'Ready to chat',
    chipClass: 'status-pill status-ready',
    accent: 'text-emerald-700',
  },
  failed: {
    icon: AlertTriangle,
    label: 'Needs attention',
    chipClass: 'status-pill status-failed',
    accent: 'text-red-700',
  },
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default function Dashboard() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const { user } = useAuth()
  const navigate = useNavigate()

  const fetchDocs = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) {
      setLoading(true)
    }

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
    const interval = setInterval(() => {
      fetchDocs()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchDocs])

  const onDrop = useCallback(
    async (acceptedFiles) => {
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
    },
    [fetchDocs],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  const handleDelete = async (id, event) => {
    event.stopPropagation()
    if (!confirm('Delete this document and all its conversations?')) return

    try {
      await deleteDocument(id)
      toast.success('Document deleted')
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      setSelectedDocs((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch {
      toast.error('Failed to delete')
    }
  }

  const toggleSelect = (id, event) => {
    event.stopPropagation()
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleMultiChat = () => {
    const ids = Array.from(selectedDocs).join(',')
    navigate(`/chat/multi?docs=${ids}`)
  }

  const readyCount = documents.filter((doc) => doc.status === 'ready').length
  const selectedCount = selectedDocs.size

  return (
    <div className="page-shell max-w-7xl py-8 sm:py-10">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="premium-card p-6 sm:p-8">
          <span className="eyebrow">Workspace overview</span>
          <div className="mt-5 space-y-3">
            <h1 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">
              Your documents, ready to work.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Upload PDFs, track readiness clearly, and open the right conversation as soon as each file is ready.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              {
                label: 'Total documents',
                value: documents.length,
                hint: user?.name ? `${user.name.split(' ')[0]}'s workspace` : 'Across your workspace',
              },
              {
                label: 'Ready for chat',
                value: readyCount,
                hint: 'Instantly searchable',
              },
            ].map((item) => (
              <div key={item.label} className="soft-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-1 text-sm text-slate-500">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`premium-card cursor-pointer overflow-hidden p-6 sm:p-7 ${
            isDragActive ? 'border-teal-300 bg-teal-50/65' : ''
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Upload zone</p>
                <h2 className="font-display mt-3 text-2xl text-slate-950">Add a new PDF</h2>
              </div>
              <div className={`icon-shell h-12 w-12 ${isDragActive ? 'bg-teal-100' : ''}`}>
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              </div>
            </div>

            <div className="rounded-[24px] border border-dashed border-slate-300/90 bg-white/72 p-6 text-center">
              <p className="text-lg font-semibold text-slate-950">
                {uploading ? 'Uploading your document...' : isDragActive ? 'Drop your PDF here' : 'Drag, drop, or browse'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Upload a single PDF up to 50MB. Indexing starts automatically so it is ready for chat as soon as processing completes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Library</p>
            <h2 className="font-display mt-2 text-3xl text-slate-950">Your documents</h2>
          </div>
          {selectedCount > 0 && (
            <div className="soft-card inline-flex items-center gap-2 px-4 py-3">
              <Check className="h-4 w-4 text-teal-700" />
              <span className="text-sm font-semibold text-slate-950">{selectedCount} selected</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="premium-card flex min-h-[16rem] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : documents.length === 0 ? (
          <div className="premium-card flex min-h-[18rem] flex-col items-center justify-center px-6 text-center">
            <div className="icon-shell h-16 w-16">
              <FolderKanban className="h-7 w-7" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold text-slate-950">No documents yet</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              Your library will appear here after the first upload. Once a file is ready, you can open a chat instantly or select multiple files for comparison.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((doc, index) => {
              const status = statusConfig[doc.status] || statusConfig.processing
              const StatusIcon = status.icon
              const isSelected = selectedDocs.has(doc.id)

              return (
                <article
                  key={doc.id}
                  onClick={() => doc.status === 'ready' && navigate(`/chat/${doc.id}`)}
                  className={`premium-card animate-rise group overflow-hidden p-5 ${
                    doc.status === 'ready' ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
                  } ${isSelected ? 'border-teal-300/90 shadow-[0_24px_60px_rgba(15,118,110,0.14)]' : ''}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {doc.status === 'ready' ? (
                        <button
                          type="button"
                          onClick={(event) => toggleSelect(doc.id, event)}
                          className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-2xl border ${
                            isSelected
                              ? 'border-teal-500 bg-teal-600 text-white'
                              : 'border-slate-200 bg-white/90 text-slate-400'
                          }`}
                          aria-label={isSelected ? 'Deselect document' : 'Select document'}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="icon-shell-warm mt-1 h-8 w-8 shrink-0">
                          <StatusIcon className="h-4 w-4" />
                        </div>
                      )}

                      <div className="icon-shell h-12 w-12 shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-950">{doc.original_filename}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {doc.page_count ? `${doc.page_count} pages` : 'Page count pending'} · Added {dateFormatter.format(new Date(doc.created_at))}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => handleDelete(doc.id, event)}
                      className="grid h-10 w-10 place-items-center rounded-2xl border border-transparent bg-white/70 text-slate-400 hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <span className={status.chipClass}>
                      <StatusIcon className={`h-3.5 w-3.5 ${status.accent}`} />
                      {status.label}
                    </span>

                    {doc.status === 'ready' ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 transition group-hover:text-teal-700">
                        Open chat
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">Processing in background</span>
                    )}
                  </div>

                  {doc.error_message && (
                    <div className="mt-4 rounded-[20px] border border-red-100 bg-red-50/80 p-4">
                      <p className="text-sm font-semibold text-red-700">Indexing issue</p>
                      <p className="mt-1 text-sm leading-6 text-red-600">{doc.error_message}</p>
                    </div>
                  )}

                  {doc.status === 'ready' && (
                    <div className="mt-5 rounded-[20px] border border-slate-200/80 bg-white/72 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[18px] border border-teal-100 bg-teal-50/90 text-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                          <MessageSquareText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Start with one sharp question</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Ask for summaries, key decisions, risks, timelines, or anything else grounded in the PDF.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {selectedCount >= 2 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 px-4">
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-[rgba(15,23,42,0.92)] px-5 py-4 text-white shadow-[0_28px_60px_rgba(15,23,42,0.28)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
                <Files className="h-5 w-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedCount} documents selected</p>
                <p className="text-sm text-slate-300">Launch one conversation across the selected set.</p>
              </div>
            </div>

            <button type="button" onClick={handleMultiChat} className="btn-primary shrink-0">
              <Files className="h-4 w-4" />
              Compare now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
