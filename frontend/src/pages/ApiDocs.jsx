import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Braces, ChevronDown, ChevronRight, Code2, Copy, FileText, KeyRound,
  MessageSquareText, Terminal, UploadCloud, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'

const endpoints = [
  {
    method: 'POST',
    path: '/api/v1/documents/upload',
    description: 'Upload a PDF document for indexing. Returns the document record with processing status.',
    icon: UploadCloud,
    color: '#6366f1',
    example: `curl -X POST \\
  -H "Authorization: Bearer pgyan_YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  https://your-domain.com/api/v1/documents/upload`,
    response: `{
  "id": "doc_abc123",
  "filename": "document.pdf",
  "status": "processing",
  "page_count": 42
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/documents',
    description: 'List all uploaded documents in your workspace with their current status.',
    icon: FileText,
    color: 'var(--teal)',
    example: `curl -H "Authorization: Bearer pgyan_YOUR_API_KEY" \\
  https://your-domain.com/api/v1/documents`,
    response: `[
  {
    "id": "doc_abc123",
    "filename": "document.pdf",
    "status": "ready",
    "page_count": 42,
    "created_at": "2024-01-15T10:30:00Z"
  }
]`,
  },
  {
    method: 'POST',
    path: '/api/v1/chat?document_id=DOC_ID',
    description: 'Send a chat message grounded in a single document. Supports streaming responses.',
    icon: MessageSquareText,
    color: '#f59e0b',
    example: `curl -X POST \\
  -H "Authorization: Bearer pgyan_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "What are the key findings?"}' \\
  "https://your-domain.com/api/v1/chat?document_id=doc_abc123"`,
    response: `{
  "response": "Based on the document, the key findings are...",
  "conversation_id": "conv_xyz789",
  "document_id": "doc_abc123"
}`,
  },
]

const methodStyles = {
  GET: { bg: '#10b98115', color: '#10b981', label: 'GET' },
  POST: { bg: '#6366f115', color: '#6366f1', label: 'POST' },
  DELETE: { bg: '#ef444415', color: '#ef4444', label: 'DELETE' },
}

function CodeBlock({ code }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    toast.success('Copied!')
  }
  return (
    <div className="relative group">
      <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-slate-300 font-mono">
        {code}
      </pre>
      <button onClick={handleCopy}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white/20 hover:text-white">
        <Copy className="h-3 w-3" />
      </button>
    </div>
  )
}

function EndpointCard({ endpoint }) {
  const [expanded, setExpanded] = useState(false)
  const method = methodStyles[endpoint.method]
  const Icon = endpoint.icon

  return (
    <div className="premium-card overflow-hidden">
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-white/40">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${endpoint.color}12` }}>
          <Icon className="h-5 w-5" style={{ color: endpoint.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: method.bg, color: method.color }}>{method.label}</span>
            <code className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{endpoint.path}</code>
          </div>
          <p className="mt-1.5 text-xs leading-5" style={{ color: 'var(--muted)' }}>{endpoint.description}</p>
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-soft)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--muted-soft)' }} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-5 pb-5 pt-4 grid gap-4 lg:grid-cols-2" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--muted-soft)' }}>Request</p>
            <CodeBlock code={endpoint.example} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--muted-soft)' }}>Response</p>
            <CodeBlock code={endpoint.response} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApiDocs() {
  return (
    <div className="page-shell max-w-6xl py-8 sm:py-10">
      {/* Header */}
      <section className="premium-card p-6 sm:p-8">
        <div className="section-intro">
          <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">API Documentation</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Upload documents, run grounded chat, and build AI-powered features through the REST API.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: KeyRound, label: 'Auth style', value: 'Bearer token', accent: 'var(--teal)' },
            { icon: Zap, label: 'Transport', value: 'REST + SSE streaming', accent: '#6366f1' },
            { icon: Terminal, label: 'Format', value: 'JSON request & response', accent: '#f59e0b' },
          ].map((item) => (
            <div key={item.label} className="soft-card flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${item.accent}12` }}>
                <item.icon className="h-4 w-4" style={{ color: item.accent }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Authentication */}
      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-shell h-11 w-11">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Authentication</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>All API requests require a bearer token.</p>
            </div>
          </div>

          <CodeBlock code={`# Include in every request header
Authorization: Bearer pgyan_YOUR_API_KEY`} />

          <p className="mt-4 text-xs leading-6" style={{ color: 'var(--muted)' }}>
            Generate keys from the{' '}
            <Link to="/api-keys" className="font-semibold" style={{ color: 'var(--teal)' }}>API Keys</Link>{' '}
            page. Each key is scoped to your workspace.
          </p>
        </div>

        <div className="premium-card p-6" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Quickstart</p>
          <h3 className="mt-2 text-xl font-bold text-white">Three steps to grounded AI</h3>
          <div className="mt-5 space-y-3">
            {[
              { num: '1', label: 'Create an API key', desc: 'From the API Keys page' },
              { num: '2', label: 'Upload a document', desc: 'POST to /api/v1/documents/upload' },
              { num: '3', label: 'Ask a question', desc: 'POST to /api/v1/chat' },
            ].map(step => (
              <div key={step.num} className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-bold text-teal-400">
                  {step.num}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{step.label}</p>
                  <p className="text-[11px] text-slate-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-shell h-11 w-11">
            <Braces className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">Core Endpoints</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Click any endpoint to expand request and response examples.</p>
          </div>
        </div>

        <div className="space-y-3">
          {endpoints.map((endpoint) => (
            <EndpointCard key={endpoint.path} endpoint={endpoint} />
          ))}
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mt-6 premium-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-shell h-11 w-11">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">Rate Limits</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Keeps the service fast and fair for everyone.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { endpoint: 'Upload', limit: '10 req/min', icon: UploadCloud },
            { endpoint: 'Chat', limit: '30 req/min', icon: MessageSquareText },
            { endpoint: 'List', limit: '60 req/min', icon: FileText },
          ].map(item => (
            <div key={item.endpoint} className="soft-card flex items-center gap-3 p-4">
              <item.icon className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-soft)' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{item.endpoint}</p>
                <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>{item.limit}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
