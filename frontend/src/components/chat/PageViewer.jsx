import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import client from '../../api/client'

export default function PageViewer({ documentId, pageNum, totalPages, onClose, onPageChange }) {
  const [loading, setLoading] = useState(true)
  const [imageSrc, setImageSrc] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setImageSrc(null)

    client.get(`/api/documents/${documentId}/page/${pageNum}`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        setImageSrc(url)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [documentId, pageNum])

  // Clean up blob URLs
  useEffect(() => {
    return () => { if (imageSrc) URL.revokeObjectURL(imageSrc) }
  }, [imageSrc])

  return (
    <div className="modal-overlay">
      <button type="button" className="modal-backdrop" onClick={onClose} />

      <div className="premium-card modal-content w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPageChange?.(pageNum - 1)}
              disabled={pageNum <= 1}
              className="btn-ghost !rounded-full !p-2 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Page {pageNum}{totalPages ? ` of ${totalPages}` : ''}
            </span>
            <button
              onClick={() => onPageChange?.(pageNum + 1)}
              disabled={totalPages && pageNum >= totalPages}
              className="btn-ghost !rounded-full !p-2 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={onClose} className="btn-ghost !rounded-full !p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center" style={{ background: 'var(--surface-soft)' }}>
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--teal)' }} />
              <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>Loading page...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Failed to load page</p>
              <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>This page may not be available</p>
            </div>
          )}
          {imageSrc && (
            <img
              src={imageSrc}
              alt={`Page ${pageNum}`}
              className="max-w-full rounded-lg shadow-lg"
            />
          )}
        </div>
      </div>
    </div>
  )
}
