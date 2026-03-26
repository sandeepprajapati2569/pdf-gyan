import { useEffect, useState } from 'react'
import { Code2, Globe, Loader2, MessageSquare, Phone, Plug, Zap } from 'lucide-react'
import { getDocuments } from '../api/documents'
import IntegrationPanel from '../components/IntegrationPanel'
import toast from 'react-hot-toast'

export default function WidgetsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocuments()
      .then(res => setDocuments(res.data || []))
      .catch(() => toast.error('Failed to load documents'))
      .finally(() => setLoading(false))
  }, [])

  const readyDocs = documents.filter(d => d.status === 'ready')

  if (loading) {
    return (
      <div className="page-shell max-w-6xl">
        <div className="premium-card flex min-h-[18rem] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell max-w-6xl py-8 sm:py-10">

      {/* ─── Header ─── */}
      <section className="premium-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">Widgets</h1>
            <p className="mt-2 max-w-xl text-base leading-7 text-slate-600">
              Embed AI chat or voice call on any website. Your visitors interact with your documents without needing an account.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Ready sources', value: readyDocs.length, color: 'var(--teal)', icon: Globe },
            { label: 'Chat widgets', value: 0, color: '#6366f1', icon: MessageSquare },
            { label: 'Call widgets', value: 0, color: '#10b981', icon: Phone },
          ].map(s => (
            <div key={s.label} className="soft-card flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${s.color}15` }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-soft)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Widget Management ─── */}
      <section className="mt-6">
        <IntegrationPanel documents={documents} />
      </section>

      {/* ─── How It Works (at the bottom) ─── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-slate-950 flex items-center gap-3 mb-4">
          <Zap className="h-5 w-5" style={{ color: '#f59e0b' }} /> How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: '1', title: 'Pick sources', icon: Globe, color: 'var(--teal)', desc: 'Select one or more ready PDFs or crawled websites as the knowledge base.' },
            { step: '2', title: 'Generate a token', icon: Code2, color: '#6366f1', desc: 'Choose chat or call mode, set an expiration, and generate a secure embed token.' },
            { step: '3', title: 'Paste & go live', icon: Plug, color: '#10b981', desc: 'Copy the script tag into your site. Your widget is live in under 30 seconds.' },
          ].map(item => (
            <div key={item.step} className="premium-card overflow-hidden transition-all hover:-translate-y-0.5">
              <div className="h-1 w-full" style={{ background: item.color }} />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${item.color}15` }}>
                    <item.icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted-soft)' }}>Step {item.step}</p>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{item.title}</h3>
                  </div>
                </div>
                <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
