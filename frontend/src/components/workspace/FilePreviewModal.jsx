import { useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Download, ExternalLink, FileSpreadsheet,
  FileText, Loader2, MessageSquareText, Presentation, Table2, X,
} from 'lucide-react'
import axios from 'axios'
import client from '../../api/client'
import ReactMarkdown from 'react-markdown'

const TYPE_ICONS = { pdf: FileText, xlsx: FileSpreadsheet, pptx: Presentation, docx: FileText, txt: FileText }
const TYPE_COLORS = { pdf: '#ef4444', xlsx: '#10b981', pptx: '#f59e0b', docx: '#3b82f6', txt: '#64748b' }
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function FilePreviewModal({ fileId, fileName, fileType, pageCount, onClose, onChat, source = 'workspace' }) {
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [imageSrc, setImageSrc] = useState(null)
  const [textContent, setTextContent] = useState(null)
  const [tables, setTables] = useState([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [slides, setSlides] = useState([])
  const [activeSlide, setActiveSlide] = useState(0)
  const [error, setError] = useState(false)

  const isPdf = fileType === 'pdf'
  const isSpreadsheet = fileType === 'xlsx'
  const totalPages = pageCount || 1
  const Icon = TYPE_ICONS[fileType] || FileText
  const color = TYPE_COLORS[fileType] || '#64748b'

  // Build download URL with auth
  const token = localStorage.getItem('token')
  const downloadUrl = `${API_BASE}/api/workspace/files/${fileId}/download`

  // For office files, try to open via Google Docs Viewer (needs public URL)
  // Since our files are behind auth, we serve them directly via iframe for PDF
  // For PPTX/DOCX we provide download + text preview

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setImageSrc(null)
    setTextContent(null)

    if (isPdf) {
      const endpoint = source === 'workspace'
        ? `/api/workspace/files/${fileId}/preview?page=${page}`
        : `/api/documents/${fileId}/page/${page}`

      client.get(endpoint, { responseType: 'arraybuffer' })
        .then(res => {
          if (cancelled) return
          const contentType = res.headers?.['content-type'] || ''
          if (contentType.includes('image')) {
            const blob = new Blob([res.data], { type: contentType })
            setImageSrc(URL.createObjectURL(blob))
          } else {
            const text = new TextDecoder().decode(res.data)
            try { setTextContent(JSON.parse(text).text || text) } catch { setTextContent(text) }
          }
          setLoading(false)
        })
        .catch((err) => {
          if (cancelled) return
          if (err.response?.data) {
            try {
              const text = new TextDecoder().decode(err.response.data)
              setTextContent(`Preview error: ${JSON.parse(text).detail || 'Unknown error'}`)
              setLoading(false)
              return
            } catch { /* fall */ }
          }
          setError(true)
          setLoading(false)
        })
    } else {
      // Non-PDF: fetch text preview
      const textEndpoint = source === 'workspace'
        ? `/api/workspace/files/${fileId}/preview`
        : `/api/workspace/files/${fileId}`

      client.get(textEndpoint)
        .then(res => {
          if (cancelled) return
          // PPTX returns structured slides
          if (res.data.slides) {
            setSlides(res.data.slides)
          }
          setTextContent(res.data.text || res.data.text_preview || '')
          setLoading(false)
        })
        .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })

      if (isSpreadsheet && source === 'workspace') {
        client.get(`/api/workspace/files/${fileId}/tables`)
          .then(res => { if (!cancelled) setTables(res.data.tables || []) })
          .catch(() => {})
      }
    }

    return () => { cancelled = true }
  }, [fileId, page, isPdf, isSpreadsheet, source])

  useEffect(() => {
    return () => { if (imageSrc) URL.revokeObjectURL(imageSrc) }
  }, [imageSrc])

  const fetchFileBlob = async () => {
    const token = localStorage.getItem('token')
    const res = await axios.get(`${API_BASE}/api/workspace/files/${fileId}/download`, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${token}` },
    })
    const contentType = res.headers['content-type'] || 'application/octet-stream'
    return new Blob([res.data], { type: contentType })
  }

  const handleDownload = async () => {
    try {
      const blob = await fetchFileBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'file'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      console.error('Download error details:', {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        url: `${API_BASE}/api/workspace/files/${fileId}/download`,
      })
      alert(`Download failed (${err?.response?.status || 'network error'}). Check console for details.`)
    }
  }

  const handleOpenInBrowser = async () => {
    try {
      const blob = await fetchFileBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      console.error('Open error details:', {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
      })
      // Fallback: try download
      handleDownload()
    }
  }

  const currentTable = tables[activeSheet]

  return (
    <div className="modal-overlay" style={{ zIndex: 55 }}>
      <button type="button" className="modal-backdrop" onClick={onClose} />

      <div className="premium-card modal-content flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden" style={{ zIndex: 56 }}>

        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${color}12` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{fileName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${color}12`, color }}>{fileType}</span>
                {isPdf && <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>{totalPages} pages</span>}
                {isSpreadsheet && tables.length > 0 && <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>{tables.length} sheet{tables.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* PPTX slide nav */}
            {fileType === 'pptx' && slides.length > 1 && (
              <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <button onClick={() => setActiveSlide(s => Math.max(0, s - 1))} disabled={activeSlide <= 0}
                  className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/60 disabled:opacity-30">
                  <ChevronLeft className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                </button>
                <span className="px-1 text-[11px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                  {activeSlide + 1}<span style={{ color: 'var(--muted-soft)' }}> / {slides.length}</span>
                </span>
                <button onClick={() => setActiveSlide(s => Math.min(slides.length - 1, s + 1))} disabled={activeSlide >= slides.length - 1}
                  className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/60 disabled:opacity-30">
                  <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>
            )}
            {/* PDF page nav */}
            {isPdf && totalPages > 1 && (
              <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/60 disabled:opacity-30">
                  <ChevronLeft className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                </button>
                <span className="px-1 text-[11px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                  {page}<span style={{ color: 'var(--muted-soft)' }}> / {totalPages}</span>
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/60 disabled:opacity-30">
                  <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>
            )}

            {/* Office file: Open / Download */}
            {(['pptx', 'docx'].includes(fileType) || isSpreadsheet) && (
              <>
                <button type="button" onClick={handleOpenInBrowser}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                  style={{ background: `${color}12`, color }}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </button>
                <button type="button" onClick={handleDownload}
                  className="grid h-8 w-8 place-items-center rounded-lg border transition hover:bg-white/60"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)' }} title="Download">
                  <Download className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {onChat && (
              <button type="button" onClick={onChat}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
                <MessageSquareText className="h-3.5 w-3.5" /> Chat
              </button>
            )}
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-slate-100">
              <X className="h-4 w-4" style={{ color: 'var(--muted-soft)' }} />
            </button>
          </div>
        </div>

        {/* ═══ Sheet Tabs (Spreadsheets) ═══ */}
        {isSpreadsheet && tables.length > 1 && (
          <div className="flex items-center gap-1 px-5 py-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
            <Table2 className="h-3 w-3 shrink-0 mr-1" style={{ color: 'var(--muted-soft)' }} />
            {tables.map((t, i) => (
              <button key={i} onClick={() => setActiveSheet(i)}
                className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
                style={{
                  background: activeSheet === i ? '#10b98115' : 'transparent',
                  color: activeSheet === i ? '#10b981' : 'var(--muted-soft)',
                }}>
                {t.sheet || `Sheet ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* ═══ Content Area ═══ */}
        <div className="flex-1 overflow-auto" style={{ background: 'var(--surface-soft)' }}>
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--teal)' }} />
              <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>Loading preview...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Icon className="h-10 w-10" style={{ color: 'var(--border)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Preview not available</p>
              <button type="button" onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition"
                style={{ background: `${color}12`, color }}>
                <Download className="h-3.5 w-3.5" /> Download to view
              </button>
            </div>
          )}

          {/* PDF Page Image */}
          {imageSrc && (
            <div className="flex items-start justify-center p-4">
              <img src={imageSrc} alt={`Page ${page}`} className="max-w-full rounded-lg shadow-lg" />
            </div>
          )}

          {/* Spreadsheet Table View */}
          {isSpreadsheet && currentTable && !loading && (
            <div className="p-4">
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-soft)' }}>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5" style={{ color: '#10b981' }} />
                    <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{currentTable.sheet || 'Sheet'}</span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                    {currentTable.row_count} rows &middot; {currentTable.col_count} columns
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider sticky left-0"
                          style={{ background: '#10b98110', color: '#10b981', borderBottom: '2px solid #10b98130', width: 32 }}>#</th>
                        {currentTable.headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                            style={{ background: '#10b98110', color: '#10b981', borderBottom: '2px solid #10b98130' }}>
                            {h || `Col ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentTable.rows.map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'var(--surface-soft)' }}>
                          <td className="px-3 py-1.5 text-[10px] font-medium sticky left-0"
                            style={{ color: 'var(--muted-soft)', background: 'inherit', borderRight: '1px solid var(--border)' }}>{ri + 1}</td>
                          {currentTable.headers.map((_, ci) => (
                            <td key={ci} className="px-3 py-1.5 text-[11px] whitespace-nowrap"
                              style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                              {row[ci] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {currentTable.row_count > currentTable.rows.length && (
                  <div className="px-4 py-2 text-center text-[10px]" style={{ color: 'var(--muted-soft)', borderTop: '1px solid var(--border)' }}>
                    Showing {currentTable.rows.length} of {currentTable.row_count} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PPTX — slide-by-slide content view + open/download */}
          {fileType === 'pptx' && !loading && !error && (
            <div className="flex h-full">
              {/* Slide list sidebar */}
              {slides.length > 0 && (
                <div className="w-48 shrink-0 overflow-y-auto border-r p-2 space-y-1.5 hidden sm:block" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  {slides.map((s, i) => {
                    const titleShape = (s.shapes || []).find(sh => sh.type === 'text' && sh.paragraphs?.length)
                    const titleText = titleShape?.paragraphs?.[0]?.text || `Slide ${s.index}`
                    return (
                      <button key={i} onClick={() => setActiveSlide(i)}
                        className="w-full rounded-xl p-2.5 text-left transition"
                        style={{
                          background: activeSlide === i ? `${color}10` : 'transparent',
                          border: activeSlide === i ? `1.5px solid ${color}40` : '1.5px solid transparent',
                        }}>
                        <div className="flex items-start gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
                            style={{ background: activeSlide === i ? `${color}20` : 'var(--border)', color: activeSlide === i ? color : 'var(--muted-soft)' }}>
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold leading-4 line-clamp-2" style={{ color: activeSlide === i ? 'var(--text)' : 'var(--muted)' }}>
                              {titleText}
                            </p>
                            <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted-soft)' }}>
                              {(s.shapes || []).filter(sh => sh.type === 'text').length} text{(s.shapes || []).filter(sh => sh.type === 'text').length !== 1 ? 's' : ''}
                              {(s.shapes || []).filter(sh => sh.type === 'table').length > 0 && ` · ${(s.shapes || []).filter(sh => sh.type === 'table').length} table`}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Main content area */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Current slide content */}
                {slides.length > 0 && (() => {
                  const slide = slides[activeSlide]
                  if (!slide) return null
                  const textShapes = (slide.shapes || []).filter(sh => sh.type === 'text')
                  const tableShapes = (slide.shapes || []).filter(sh => sh.type === 'table')
                  return (
                    <div className="premium-card overflow-hidden">
                      {/* Slide header */}
                      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)', background: `${color}05` }}>
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: color }}>
                            {slide.index}
                          </span>
                          <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Slide {slide.index}</span>
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                          {textShapes.length} text block{textShapes.length !== 1 ? 's' : ''}{tableShapes.length > 0 ? ` · ${tableShapes.length} table${tableShapes.length !== 1 ? 's' : ''}` : ''}
                        </span>
                      </div>

                      {/* Slide body */}
                      <div className="p-5 space-y-4">
                        {textShapes.map((shape, si) => (
                          <div key={si}>
                            {(shape.paragraphs || []).map((p, pi) => {
                              const size = p.font_size || 14
                              const isTitle = size >= 20
                              return (
                                <p key={pi} className={isTitle ? 'mb-2' : 'mb-1'} style={{
                                  fontSize: isTitle ? '18px' : size >= 14 ? '14px' : '13px',
                                  fontWeight: p.bold || isTitle ? 700 : 400,
                                  color: p.color || 'var(--text)',
                                  lineHeight: 1.5,
                                }}>
                                  {p.text}
                                </p>
                              )
                            })}
                          </div>
                        ))}

                        {tableShapes.map((shape, ti) => (
                          <div key={`t-${ti}`} className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
                            <table className="w-full text-left">
                              <thead>
                                <tr>
                                  {(shape.headers || []).map((h, hi) => (
                                    <th key={hi} className="px-3 py-2 text-[10px] font-bold uppercase whitespace-nowrap"
                                      style={{ background: `${color}10`, color, borderBottom: `2px solid ${color}30` }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(shape.rows || []).map((row, ri) => (
                                  <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'var(--surface-soft)' }}>
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="px-3 py-1.5 text-[11px] whitespace-nowrap"
                                        style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}

                        {textShapes.length === 0 && tableShapes.length === 0 && (
                          <p className="text-xs italic" style={{ color: 'var(--muted-soft)' }}>This slide has no text or table content (may contain images or shapes)</p>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Fallback to raw text if no structured slides */}
                {slides.length === 0 && textContent && (
                  <div className="premium-card p-5 max-w-3xl">
                    <div className="prose prose-sm max-w-none text-xs leading-6" style={{ color: 'var(--text)' }}>
                      <ReactMarkdown>{textContent}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DOCX — text content */}
          {fileType === 'docx' && textContent && !loading && !error && (
            <div className="p-5">
              <div className="premium-card p-5 max-w-3xl mx-auto">
                <div className="prose prose-sm max-w-none text-xs leading-6" style={{ color: 'var(--text)' }}>
                  <ReactMarkdown>{textContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Plain text files (TXT, CSV, MD) */}
          {textContent && !imageSrc && !isSpreadsheet && fileType !== 'pptx' && fileType !== 'docx' && !loading && (
            <div className="p-5">
              <div className="premium-card p-5 max-w-3xl mx-auto">
                <div className="prose prose-sm max-w-none text-xs leading-6" style={{ color: 'var(--text)' }}>
                  <ReactMarkdown>{textContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
