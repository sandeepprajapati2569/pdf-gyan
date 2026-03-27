import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Type, X } from 'lucide-react'
import client from '../../api/client'

export default function RedactionSelector({ fileId, fileType, pageCount, redactions, onChange, onClose }) {
  const [thumbnails, setThumbnails] = useState({})
  const [loading, setLoading] = useState(false)
  const [hiddenPages, setHiddenPages] = useState(() => new Set(redactions.filter(r => r.type === 'page').map(r => r.page)))
  const [textRedactions, setTextRedactions] = useState(() => {
    const set = new Set()
    redactions.filter(r => r.type === 'text').forEach(r => set.add(`${r.page}:${r.text}`))
    return set
  })

  // Visual redaction mode
  const [activePage, setActivePage] = useState(null)
  const [pageImage, setPageImage] = useState(null)
  const [textBlocks, setTextBlocks] = useState([])
  const [pageLoading, setPageLoading] = useState(false)
  const containerRef = useRef(null)

  // Load thumbnails
  useEffect(() => {
    if (fileType !== 'pdf' || !pageCount) return
    setLoading(true)
    const pages = Array.from({ length: Math.min(pageCount, 50) }, (_, i) => i + 1)
    Promise.all(
      pages.map(p =>
        client.get(`/api/workspace/files/${fileId}/preview?page=${p}`, { responseType: 'blob' })
          .then(res => ({ page: p, url: URL.createObjectURL(res.data) }))
          .catch(() => ({ page: p, url: null }))
      )
    ).then(results => {
      const map = {}
      results.forEach(r => { if (r.url) map[r.page] = r.url })
      setThumbnails(map)
      setLoading(false)
    })
  }, [fileId, fileType, pageCount])

  // Load full page image + text blocks for visual mode
  const openPageEditor = useCallback(async (pageNum) => {
    setActivePage(pageNum)
    setPageLoading(true)
    try {
      const [imgRes, txtRes] = await Promise.all([
        client.get(`/api/workspace/files/${fileId}/preview?page=${pageNum}`, { responseType: 'blob' }),
        client.get(`/api/sharespace/files/${fileId}/page-text?page=${pageNum}`),
      ])
      setPageImage(URL.createObjectURL(imgRes.data))
      setTextBlocks(txtRes.data.blocks || [])
    } catch {
      setTextBlocks([])
    } finally {
      setPageLoading(false)
    }
  }, [fileId])

  const togglePage = (p) => {
    setHiddenPages(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })
  }

  const toggleText = (pageNum, text) => {
    const key = `${pageNum}:${text}`
    setTextRedactions(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const isTextRedacted = (pageNum, text) => textRedactions.has(`${pageNum}:${text}`)

  const getPageTextCount = (p) => {
    let c = 0
    for (const k of textRedactions) if (k.startsWith(`${p}:`)) c++
    return c
  }

  const handleDone = () => {
    const pageR = Array.from(hiddenPages).map(p => ({ type: 'page', page: p }))
    const textR = Array.from(textRedactions).map(key => {
      const idx = key.indexOf(':')
      return { type: 'text', page: parseInt(key.slice(0, idx)), text: key.slice(idx + 1) }
    })
    onChange([...pageR, ...textR])
    onClose()
  }

  const totalRedactions = hiddenPages.size + textRedactions.size

  // ══════════════════════════════════════════
  // VISUAL PAGE EDITOR MODE
  // ══════════════════════════════════════════
  if (activePage) {
    return (
      <div className="modal-overlay" style={{ zIndex: 65 }}>
        <button type="button" className="modal-backdrop" onClick={() => setActivePage(null)} />
        <div className="premium-card modal-content w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden" style={{ zIndex: 66 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => setActivePage(null)} className="btn-ghost !rounded-full !p-2">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Page {activePage} — Click text to redact</p>
                <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                  Click on any text to black it out. Click again to undo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Page nav */}
              <button onClick={() => openPageEditor(Math.max(1, activePage - 1))} disabled={activePage <= 1}
                className="btn-ghost !rounded-full !p-1.5 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{activePage}/{pageCount}</span>
              <button onClick={() => openPageEditor(Math.min(pageCount, activePage + 1))} disabled={activePage >= pageCount}
                className="btn-ghost !rounded-full !p-1.5 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Page with text overlay */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-4" style={{ background: 'var(--surface-soft)' }} ref={containerRef}>
            {pageLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--teal)' }} />
                <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>Loading page...</p>
              </div>
            ) : (
              <div className="relative inline-block shadow-xl rounded-lg overflow-hidden" style={{ maxWidth: '100%' }}>
                {/* PDF page image */}
                {pageImage && <img src={pageImage} alt={`Page ${activePage}`} className="block max-w-full" draggable={false} />}

                {/* Text overlay — positioned blocks you can click */}
                {textBlocks.map((block, i) => {
                  const redacted = isTextRedacted(activePage, block.text)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleText(activePage, block.text)}
                      className="absolute transition-colors duration-150"
                      style={{
                        left: `${block.pct.x}%`,
                        top: `${block.pct.y}%`,
                        width: `${block.pct.w}%`,
                        height: `${block.pct.h}%`,
                        background: redacted ? 'rgba(15, 23, 42, 0.92)' : 'transparent',
                        border: redacted ? 'none' : undefined,
                        cursor: 'pointer',
                        borderRadius: redacted ? '2px' : undefined,
                      }}
                      title={redacted ? `Redacted: "${block.text}" — click to undo` : `Click to redact: "${block.text}"`}
                    >
                      {/* Hover highlight for non-redacted text */}
                      {!redacted && (
                        <div className="absolute inset-0 rounded-sm opacity-0 hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(245, 158, 11, 0.25)', border: '1px solid rgba(245, 158, 11, 0.5)' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>
              {getPageTextCount(activePage)} text redaction{getPageTextCount(activePage) !== 1 ? 's' : ''} on this page
            </p>
            <button type="button" onClick={() => setActivePage(null)} className="btn-primary text-sm">
              Back to pages
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════
  // PAGE GRID MODE
  // ══════════════════════════════════════════
  return (
    <div className="modal-overlay" style={{ zIndex: 65 }}>
      <button type="button" className="modal-backdrop" onClick={onClose} />
      <div className="premium-card modal-content w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden" style={{ zIndex: 66 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>Content Redaction</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-soft)' }}>
              Click a page to hide it entirely, or double-click to select specific text to black out.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost !rounded-full !p-2"><X className="h-4 w-4" /></button>
        </div>

        {/* Page grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--teal)' }} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {Array.from({ length: pageCount || 0 }, (_, i) => i + 1).map(p => {
                const isHidden = hiddenPages.has(p)
                const textCount = getPageTextCount(p)
                return (
                  <div key={p} className="relative group">
                    {/* Page thumbnail — click to hide, double-click to edit text */}
                    <button
                      type="button"
                      onClick={() => togglePage(p)}
                      onDoubleClick={(e) => { e.preventDefault(); if (!isHidden) openPageEditor(p) }}
                      className={`w-full rounded-xl border overflow-hidden transition hover:shadow-md ${isHidden ? 'ring-2 ring-amber-400' : ''}`}
                      style={{ borderColor: isHidden ? '#f59e0b' : 'var(--border)', aspectRatio: '3/4' }}
                    >
                      {thumbnails[p] ? (
                        <img src={thumbnails[p]} alt={`Page ${p}`}
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ opacity: isHidden ? 0.15 : 1, filter: isHidden ? 'grayscale(100%)' : 'none' }} />
                      ) : (
                        <div className="absolute inset-0" style={{ background: 'var(--surface-soft)' }} />
                      )}

                      {isHidden && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(245,158,11,0.15)' }}>
                          <EyeOff className="h-5 w-5" style={{ color: '#f59e0b' }} />
                          <span className="text-[9px] font-bold" style={{ color: '#f59e0b' }}>PAGE HIDDEN</span>
                        </div>
                      )}

                      {!isHidden && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ background: 'rgba(0,0,0,0.25)' }}>
                          <span className="text-[9px] text-white font-bold bg-black/50 px-2 py-1 rounded-md">Click: hide page / Double-click: edit text</span>
                        </div>
                      )}

                      <div className="absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--text)' }}>
                        {p}
                      </div>

                      {textCount > 0 && !isHidden && (
                        <div className="absolute top-1 right-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#f59e0b', color: 'white' }}>
                          {textCount} redacted
                        </div>
                      )}
                    </button>

                    {/* Quick edit text button */}
                    {!isHidden && (
                      <button type="button" onClick={() => openPageEditor(p)}
                        className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-lg opacity-0 group-hover:opacity-100 transition"
                        style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                        title="Select text to redact">
                        <Type className="h-3 w-3" style={{ color: 'var(--text)' }} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { setHiddenPages(new Set()); setTextRedactions(new Set()) }}
              className="text-xs font-semibold transition" style={{ color: 'var(--teal)' }}>
              <Eye className="inline h-3 w-3 mr-0.5" /> Clear All
            </button>
          </div>
          <button type="button" onClick={handleDone} className="btn-primary text-sm">
            Done ({totalRedactions} redaction{totalRedactions !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  )
}
