import { Link } from 'react-router-dom'
import { Braces, FileText, KeyRound, MessageSquareText, UploadCloud } from 'lucide-react'

const endpoints = [
  {
    method: 'POST',
    path: '/api/v1/documents/upload',
    description: 'Upload a PDF document for indexing.',
    icon: UploadCloud,
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
    description: 'List all uploaded documents in your workspace.',
    icon: FileText,
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
    description: 'Send a chat message grounded in a single document.',
    icon: MessageSquareText,
    example: `curl -X POST \\
  -H "Authorization: Bearer pgyan_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "What are the key findings?", "document_id": "doc_abc123"}' \\
  "https://your-domain.com/api/v1/chat?document_id=doc_abc123"`,
    response: `{
  "response": "Based on the document, the key findings are...",
  "conversation_id": "conv_xyz789",
  "document_id": "doc_abc123"
}`,
  },
]

const methodStyles = {
  GET: 'bg-emerald-50 text-emerald-700',
  POST: 'bg-sky-50 text-sky-700',
  DELETE: 'bg-red-50 text-red-700',
}

export default function ApiDocs() {
  return (
    <div className="page-shell max-w-6xl py-8 sm:py-10">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
        <div className="premium-card p-6 sm:p-8">
          <span className="eyebrow">Developer docs</span>
          <div className="mt-5 space-y-3">
            <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">API documentation</h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Everything you need to upload PDFs, list indexed documents, and run grounded chat experiences through the API.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Auth style', value: 'Bearer key' },
              { label: 'Transport', value: 'REST + streaming' },
              { label: 'Primary flows', value: 'Upload, list, chat' },
            ].map((item) => (
              <div key={item.label} className="soft-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-card p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-12 w-12">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Authentication</h2>
              <p className="text-sm text-slate-500">All requests require a bearer token generated from your dashboard.</p>
            </div>
          </div>

          <pre className="mt-6 overflow-x-auto rounded-[24px] border border-slate-200/80 bg-slate-950 p-4 text-sm text-slate-100">
Authorization: Bearer pgyan_YOUR_API_KEY
          </pre>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            Need a key first? Create one from the{' '}
            <Link to="/api-keys" className="font-semibold text-teal-700 hover:text-teal-800">
              API Keys
            </Link>{' '}
            page.
          </p>
        </div>
      </section>

      <section className="mt-6 premium-card overflow-hidden">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-12 w-12">
              <Braces className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Core endpoints</h2>
              <p className="text-sm text-slate-500">The essential flows for document upload, listing, and chat.</p>
            </div>
          </div>
        </div>

        <div className="space-y-0">
          {endpoints.map((endpoint) => (
            <article key={endpoint.path} className="border-b border-slate-200/80 p-6 last:border-b-0">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="icon-shell h-12 w-12">
                      <endpoint.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${methodStyles[endpoint.method]}`}>
                          {endpoint.method}
                        </span>
                        <code className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                          {endpoint.path}
                        </code>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{endpoint.description}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="soft-card p-5">
                    <p className="text-sm font-semibold text-slate-950">Example request</p>
                    <pre className="mt-4 overflow-x-auto rounded-[20px] border border-slate-200/80 bg-slate-950 p-4 text-sm text-slate-100">
{endpoint.example}
                    </pre>
                  </div>

                  <div className="soft-card p-5">
                    <p className="text-sm font-semibold text-slate-950">Example response</p>
                    <pre className="mt-4 overflow-x-auto rounded-[20px] border border-slate-200/80 bg-slate-950 p-4 text-sm text-slate-100">
{endpoint.response}
                    </pre>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="premium-card p-6 sm:p-7">
          <h2 className="text-xl font-semibold text-slate-950">Rate limits</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Limits keep the service responsive and predictable for everyone on the platform.
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            <li className="soft-card px-4 py-3">Upload: 10 requests per minute</li>
            <li className="soft-card px-4 py-3">Chat: 30 requests per minute</li>
            <li className="soft-card px-4 py-3">List: 60 requests per minute</li>
          </ul>
        </div>

        <div className="premium-card premium-card-dark overflow-hidden p-6 text-slate-100 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Quickstart</p>
          <h2 className="mt-3 font-display text-3xl text-white">Ship a document-aware feature faster</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Use the dashboard to create a key, upload a document, then call the chat endpoint from your app for grounded answers and saved conversation threads.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Create key', 'Upload PDF', 'Call chat endpoint'].map((step) => (
              <div key={step} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-slate-200">
                {step}
              </div>
            ))}
          </div>

          <Link to="/register" className="btn-secondary mt-6 inline-flex border-white/10 bg-white/10 text-white hover:bg-white/14">
            Create a workspace
          </Link>
        </div>
      </section>
    </div>
  )
}
