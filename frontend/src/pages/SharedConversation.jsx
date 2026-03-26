import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Loader2, MessageSquareText, Share2 } from 'lucide-react'
import client from '../api/client'

export default function SharedConversation() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await client.get(`/api/shared/${token}`)
        setData(res.data)
      } catch (err) {
        setError(err.response?.data?.detail || 'This shared conversation is not available or has expired.')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [token])

  if (loading) {
    return (
      <div className="page-shell max-w-4xl py-12">
        <div className="premium-card flex min-h-[20rem] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--teal)]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-shell max-w-4xl py-12">
        <div className="premium-card flex min-h-[20rem] flex-col items-center justify-center p-8 text-center">
          <Share2 className="h-10 w-10 text-[var(--muted-soft)] mb-4" />
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Not Available</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell max-w-4xl py-8 sm:py-12">
      <div className="premium-card overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-10 w-10 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-soft)' }}>
                Shared conversation
              </p>
              <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{data.document_name}</h1>
            </div>
          </div>
          {data.title && (
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{data.title}</p>
          )}
        </div>

        {/* Messages */}
        <div className="p-5 sm:p-6 space-y-5">
          {data.messages?.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' ? (
                <div className="max-w-[88%] sm:max-w-[80%]">
                  <div className="flex items-start gap-3">
                    <div className="icon-shell h-9 w-9 shrink-0 mt-1">
                      <MessageSquareText className="h-3.5 w-3.5" />
                    </div>
                    <div className="soft-card px-4 py-3 text-sm leading-7" style={{ color: 'var(--text)' }}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="max-w-[88%] sm:max-w-[72%] rounded-[24px] px-5 py-4 text-sm leading-7 text-white"
                  style={{ background: 'linear-gradient(135deg, #0f172a, #1f2937)', boxShadow: '0 22px 38px rgba(15,23,42,0.18)' }}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] px-5 py-3 text-center">
          <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>
            Shared via PDF Gyan · Read-only view
          </p>
        </div>
      </div>
    </div>
  )
}
