import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Braces,
  Database,
  FileStack,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import BrandMark from '../components/ui/BrandMark'

const features = [
  {
    icon: MessageSquareQuote,
    title: 'Answers that feel grounded',
    description: 'Ask questions in plain language and get confident responses built from your uploaded PDFs.',
  },
  {
    icon: Braces,
    title: 'API-ready from day one',
    description: 'Generate keys, call the REST API, and bring the same document intelligence into your own product.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure workspace controls',
    description: 'Keep access, workspace behavior, and data handling clear as your usage grows.',
  },
  {
    icon: Workflow,
    title: 'Multi-document reasoning',
    description: 'Move past one-file-at-a-time workflows and ask questions across a selected set of documents.',
  },
  {
    icon: Database,
    title: 'No vector database required',
    description: 'Leverage PageIndex for structured understanding instead of bolting on a more fragile search layer.',
  },
  {
    icon: FileStack,
    title: 'A workspace, not just a demo',
    description: 'Manage uploads, monitor readiness, revisit conversations, and keep the entire flow organized.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Upload and prepare',
    text: 'Drop in a PDF and let the workspace prepare it for grounded answers and reusable history.',
  },
  {
    number: '02',
    title: 'Chat with context',
    text: 'Start a new conversation, revisit old threads, or compare multiple documents side by side.',
  },
  {
    number: '03',
    title: 'Ship it via API',
    text: 'Use the same clean experience from your product by generating keys and integrating the API.',
  },
]

const quickstartItems = [
  {
    icon: ShieldCheck,
    title: 'Create a workspace key',
    text: 'Generate one key in settings and use it across uploads and chat requests.',
  },
  {
    icon: FileStack,
    title: 'Upload once',
    text: 'Send the PDF, wait for ready status, and keep the document available for follow-up questions.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Ask from your product',
    text: 'Pass user questions through the chat flow and return grounded answers with less glue code.',
  },
]

const capabilityRailItems = [
  {
    icon: FileStack,
    label: 'Indexing flow',
    title: 'Structured from the first upload',
    description: 'Page-aware prep with clear ready states.',
  },
  {
    icon: MessageSquareQuote,
    label: 'Answer quality',
    title: 'Responses that stay grounded',
    description: 'Summaries and insights your team can trust.',
  },
  {
    icon: Braces,
    label: 'Deployment mode',
    title: 'One workflow for app and API',
    description: 'Use the same flow in the UI and via REST.',
  },
  {
    icon: Workflow,
    label: 'Multi-doc chat',
    title: 'Compare more than one file at once',
    description: 'Compare overlap and differences faster.',
  },
  {
    icon: Bot,
    label: 'Conversation history',
    title: 'Pick up where work stopped',
    description: 'Reopen the last thread instantly.',
  },
  {
    icon: ShieldCheck,
    label: 'API support',
    title: 'Built for product teams too',
    description: 'Connect uploads and chat to your product.',
  },
]

export default function Landing() {
  return (
    <div className="pb-12 sm:pb-20">
      <section className="page-shell max-w-7xl pb-8 pt-8 sm:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.06fr)_minmax(420px,0.94fr)]">
          <div className="animate-rise space-y-7">
            <span className="eyebrow">PDFs, clarified</span>

            <div className="space-y-5">
              <h1 className="font-display max-w-4xl text-5xl leading-[1.02] text-slate-950 sm:text-6xl xl:text-7xl">
                Turn PDFs into answers your team can use.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Upload files, chat with context, compare documents, and bring the same workflow into
                your product.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary">
                <Sparkles className="h-4 w-4" />
                Start free
              </Link>
              <Link to="/api-docs" className="btn-secondary">
                View API docs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

          </div>

          <div className="premium-card animate-rise relative overflow-hidden p-5 sm:p-7" style={{ animationDelay: '120ms' }}>
            <div className="absolute right-[-3rem] top-[-2rem] h-40 w-40 rounded-full bg-teal-300/18 blur-3xl" />
            <div className="absolute bottom-[-4rem] left-[-1rem] h-48 w-48 rounded-full bg-amber-200/28 blur-3xl" />

            <div className="relative space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-3 py-2">
                  <BrandMark className="h-10 w-10 shrink-0" />
                  <div>
                    <p className="font-display text-sm text-slate-950">Live workspace</p>
                    <p className="text-xs text-slate-500">Cleaner hierarchy, better flow</p>
                  </div>
                </div>
                <span className="soft-pill">
                  <Bot className="h-4 w-4 text-teal-700" />
                  AI grounded in your PDFs
                </span>
              </div>

              <div className="soft-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-shell h-12 w-12">
                      <FileStack className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">Quarterly Strategy Review.pdf</p>
                      <p className="text-sm text-slate-500">Ready for chat · 42 pages</p>
                    </div>
                  </div>
                  <span className="status-pill status-ready">Ready</span>
                </div>

                <div className="mt-5 rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,251,250,0.82))] p-4 shadow-[0_20px_42px_rgba(15,23,42,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live conversation</p>

                  <div className="mt-4 flex justify-end">
                    <div className="max-w-[90%] rounded-[22px] bg-slate-950 px-5 py-4 text-slate-100 shadow-[0_20px_36px_rgba(15,23,42,0.18)]">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Question</p>
                      <p className="mt-3 text-sm leading-7 text-slate-200">
                        What are the top three risks called out in this quarter&apos;s review?
                      </p>
                    </div>
                  </div>

                  <div className="ml-auto mr-6 h-5 w-px bg-gradient-to-b from-slate-200 via-teal-200 to-transparent" />

                  <div className="flex items-start gap-3">
                    <div className="icon-shell h-11 w-11 shrink-0">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="flex-1 rounded-[22px] border border-teal-100 bg-teal-50/75 px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-teal-700">Answer preview</p>
                      <p className="mt-3 text-sm leading-7 text-slate-700">
                        Margin pressure, supplier concentration, and delayed enterprise renewals show
                        up repeatedly across the summary sections.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {['3 risks surfaced', 'Summary-backed', 'Ready to continue'].map((tag) => (
                          <span key={tag} className="soft-pill bg-white/80 text-slate-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="marquee-shell marquee-shell-full animate-rise mt-8" style={{ animationDelay: '180ms' }}>
          <div className="marquee-mask">
            <div className="marquee-track">
              {[0, 1].map((copyIndex) => (
                <div key={copyIndex} className="marquee-group">
                  {capabilityRailItems.map((item) => (
                    <article key={`${copyIndex}-${item.label}`} className="marquee-card">
                      <div className="flex items-center gap-2">
                        <div className="icon-shell h-8 w-8 shrink-0 rounded-2xl">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {item.label}
                        </p>
                      </div>
                      <p className="mt-3 text-[0.88rem] font-semibold leading-5 text-slate-950">{item.title}</p>
                      <p className="mt-1.5 text-[0.78rem] leading-5 text-slate-600">{item.description}</p>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell max-w-7xl py-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Designed like a real product</span>
          <h2 className="font-display mt-5 text-4xl text-slate-950 sm:text-5xl">
            Everything your document workflow needs.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Focused surfaces, cleaner icons, sharper status states, and subtle motion make the
            product feel deliberate from first click to final answer.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="icon-shell h-12 w-12">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell max-w-7xl py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <div className="premium-card p-6 sm:p-8">
            <span className="eyebrow">How it flows</span>
            <div className="mt-5 space-y-5">
              <h2 className="font-display text-3xl text-slate-950 sm:text-4xl">
                A simple flow from upload to answer.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Prepare the document, ask better questions, and put the workflow to work through the
                API.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {steps.map((step, index) => (
                <article
                  key={step.number}
                  className="premium-card animate-rise relative overflow-hidden p-4 sm:p-5"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-500/80 via-sky-500/60 to-amber-400/70" />

                  <div className="flex items-start gap-4 sm:gap-5">
                    <div className="shrink-0 pt-0.5">
                      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-950 px-3 text-sm font-bold tracking-[0.18em] text-white shadow-[0_14px_24px_rgba(15,23,42,0.14)]">
                        {step.number}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-950 sm:text-lg">{step.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[0.95rem]">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
              </div>
          </div>

          <div className="premium-card premium-card-dark overflow-hidden p-6 text-slate-100 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-100">Developer quickstart</p>
                <h3 className="mt-3 font-display text-2xl text-white">Ship it without extra glue</h3>
              </div>
              <div className="icon-shell h-12 w-12 border-white/10 bg-white/10 text-teal-300">
                <Braces className="h-5 w-5" />
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-white">
              Create a key, upload a document, and plug the same grounded workflow into your app with
              a clean REST surface.
            </p>

            <div className="mt-6 space-y-3">
              {quickstartItems.map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-white/14 bg-slate-900/75 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="icon-shell h-10 w-10 shrink-0 border-teal-200/16 bg-teal-400/10 text-teal-100">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-teal-100">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-100">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <pre className="mt-6 overflow-x-auto rounded-[22px] border border-white/14 bg-black/30 p-4 text-sm text-white">
{`curl -X POST \\
  -H "Authorization: Bearer pgyan_YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  https://your-domain.com/api/v1/documents/upload`}
            </pre>

            <Link to="/api-docs" className="btn-secondary mt-6 w-full justify-center border-white/10 bg-white/10 text-white hover:bg-white/14">
              Explore the API
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="page-shell max-w-6xl py-10">
        <div className="grid gap-5 md:grid-cols-2">
          <article className="premium-card p-7">
            <span className="soft-pill bg-white/70 text-teal-700">Start clean</span>
            <h3 className="font-display mt-5 text-3xl text-slate-950">Starter</h3>
            <p className="mt-2 text-slate-500">Best for individuals and lean product teams.</p>
            <p className="mt-6 text-5xl font-semibold text-slate-950">
              $0<span className="text-xl font-medium text-slate-400"> forever</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-600">
              <li>Unlimited document uploads</li>
              <li>Unlimited chat sessions</li>
              <li>API access included</li>
              <li>Self-serve workspace setup</li>
            </ul>
            <Link to="/register" className="btn-secondary mt-8 w-full justify-center">
              Get started
            </Link>
          </article>

          <article className="premium-card relative overflow-hidden border-teal-200/60 bg-[linear-gradient(180deg,rgba(15,118,110,0.06),rgba(255,255,255,0.94))] p-7">
            <div className="absolute right-5 top-5 rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Popular
            </div>
            <span className="soft-pill bg-teal-50/80 text-teal-700">Managed usage</span>
            <h3 className="font-display mt-5 text-3xl text-slate-950">Pro</h3>
            <p className="mt-2 text-slate-500">Best for teams that want the platform to handle the stack.</p>
            <p className="mt-6 text-5xl font-semibold text-slate-950">Pay as you go</p>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-600">
              <li>Everything in Free</li>
              <li>Managed platform usage</li>
              <li>Usage-based billing</li>
              <li>Priority support</li>
            </ul>
            <Link to="/register" className="btn-primary mt-8 w-full justify-center">
              Launch workspace
            </Link>
          </article>
        </div>
      </section>

      <footer className="page-shell max-w-7xl py-10">
        <div className="premium-card flex flex-col items-center justify-between gap-6 px-6 py-7 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12 shrink-0" />
            <div>
              <p className="font-display text-xl text-slate-950">PDF Gyan</p>
              <p className="text-sm text-slate-500">Built on PageIndex for cleaner document intelligence.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/api-docs" className="btn-ghost">
              API Docs
            </Link>
            <Link to="/register" className="btn-primary">
              Start building
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
