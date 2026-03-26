import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Braces,
  Cpu,
  Database,
  FileStack,
  Globe,
  MessageSquareQuote,
  Phone,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import BrandMark from '../components/ui/BrandMark'

const spotlightCards = [
  {
    icon: Globe,
    title: 'Crawl a live website into the workspace',
    description: 'Turn docs centers, help pages, or marketing sites into a searchable source beside your PDFs.',
  },
  {
    icon: Phone,
    title: 'Switch from typing to voice',
    description: 'Open call mode when a conversation is easier to speak through than type out line by line.',
  },
  {
    icon: Braces,
    title: 'Ship the same flow in your product',
    description: 'Generate keys, embed widgets, or call the API without rebuilding the workflow from scratch.',
  },
  {
    icon: Cpu,
    title: 'Choose the stack that fits the team',
    description: 'Run hosted, bring your own OpenAI stack, or move fully local with Ollama plus MongoDB.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Bring in a source',
    text: 'Upload a PDF or crawl a website. The workspace prepares it and keeps the readiness state obvious.',
  },
  {
    number: '02',
    title: 'Work through chat or voice',
    text: 'Ask a focused question, compare documents, reopen history, or switch into call mode for a faster back-and-forth.',
  },
  {
    number: '03',
    title: 'Reuse the workflow anywhere',
    text: 'Take the same experience into your app with API keys, shared conversations, and embeddable widgets.',
  },
]

const quickstartItems = [
  {
    icon: ShieldCheck,
    title: 'Create a workspace key',
    text: 'Generate one key and keep upload, chat, and widget calls behind the same clean auth layer.',
  },
  {
    icon: Database,
    title: 'Send a source once',
    text: 'Upload a PDF or crawl a website, then keep the indexed source ready for every follow-up question.',
  },
  {
    icon: Workflow,
    title: 'Reply inside your product',
    text: 'Pass the user question through the same grounded chat flow and return the answer where they already work.',
  },
]

const capabilityRailItems = [
  {
    icon: FileStack,
    label: 'Indexing flow',
    title: 'PageIndex keeps structure intact',
    description: 'Uploads move from processing to ready with a clear state the team can trust.',
  },
  {
    icon: MessageSquareQuote,
    label: 'Answer quality',
    title: 'Chat stays anchored to the source',
    description: 'Summaries, follow-ups, and comparisons keep the document context in view.',
  },
  {
    icon: Cpu,
    label: 'Deployment mode',
    title: 'Hosted, private, or local',
    description: 'Choose the model and storage path that fits your security and ops needs.',
  },
  {
    icon: Workflow,
    label: 'Multi-doc chat',
    title: 'Compare files side by side',
    description: 'Ask for overlaps, differences, and repeated signals across more than one source.',
  },
  {
    icon: Bot,
    label: 'Conversation history',
    title: 'Return to the last working thread',
    description: 'Pick up the same context without hunting through old screens.',
  },
  {
    icon: Braces,
    label: 'API support',
    title: 'Built to move beyond the dashboard',
    description: 'Use REST endpoints and widgets to extend the workflow into your own product.',
  },
]

const modeCards = [
  {
    icon: Globe,
    eyebrow: 'Fastest setup',
    title: 'Public mode',
    description: 'Use the hosted stack when you want the workspace live quickly and managed for you.',
    bullets: ['Hosted storage', 'Platform-managed AI usage', 'Best for the quickest start'],
    surfaceClass: 'premium-card',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Bring your own stack',
    title: 'Private mode',
    description: 'Keep new uploads and conversations in your MongoDB while using your own OpenAI key.',
    bullets: ['MongoDB in your control', 'Your OpenAI account', 'Clear separation for new data'],
    surfaceClass: 'premium-card',
  },
  {
    icon: Bot,
    eyebrow: 'Fully local',
    title: 'Local mode',
    description: 'Run indexing and chat through Ollama on your machine while storing data in MongoDB.',
    bullets: ['Ollama-powered chat', 'MongoDB storage', 'Good fit for local-first teams'],
    surfaceClass: 'premium-card premium-card-dark text-slate-100',
  },
]

export default function Landing() {
  return (
    <div className="pb-12 sm:pb-20">
      <section className="page-shell max-w-7xl pb-8 pt-8 sm:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,0.96fr)]">
          <div className="animate-rise space-y-7">
            <span className="eyebrow">Knowledge that stays usable</span>

            <div className="space-y-5">
              <h1 className="font-display max-w-4xl text-5xl leading-[1.02] text-slate-950 sm:text-6xl xl:text-7xl">
                Turn PDFs and websites into answers your team can use.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Upload files, crawl pages, chat with context, compare sources, and move the same
                workflow into your product when you are ready.
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

            <div className="flex flex-wrap gap-2">
              {['PDF upload', 'Website crawl', 'Voice call', 'Embeddable widgets'].map((item) => (
                <span key={item} className="soft-pill text-sm">
                  {item}
                </span>
              ))}
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
                    <p className="text-xs text-slate-500">One place for upload, chat, and handoff</p>
                  </div>
                </div>
                <span className="soft-pill">
                  <Bot className="h-4 w-4 text-teal-700" />
                  Ready for grounded answers
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
                      <p className="text-sm text-slate-500">Ready for chat and call · 42 pages</p>
                    </div>
                  </div>
                  <span className="status-pill status-ready">Ready</span>
                </div>

                <div className="mt-5 rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,251,250,0.82))] p-4 shadow-[0_20px_42px_rgba(15,23,42,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live thread</p>

                  <div className="mt-4 flex justify-end">
                    <div className="max-w-[90%] rounded-[22px] bg-slate-950 px-5 py-4 text-slate-100 shadow-[0_20px_36px_rgba(15,23,42,0.18)]">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Question</p>
                      <p className="mt-3 text-sm leading-7 text-slate-200">
                        Where are the renewal risks showing up, and what should leadership watch
                        first?
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
                        The document flags delayed enterprise renewals, margin pressure in the mid-market,
                        and supplier concentration as the three themes leadership should monitor first.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {['3 signals surfaced', 'Thread saved', 'Voice follow-up ready'].map((tag) => (
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
        <div className="section-intro">
          <span className="eyebrow">What opens up next</span>
          <h2 className="font-display text-4xl text-slate-950 sm:text-5xl">
            The product keeps going after the first upload.
          </h2>
          <p className="max-w-3xl text-lg leading-8 text-slate-600">
            PDF Gyan is more than a chat box. It helps teams bring in websites, switch to voice,
            share knowledge externally, and choose the model stack that matches how they work.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {spotlightCards.map((card, index) => (
            <article
              key={card.title}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="icon-shell h-12 w-12">
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell max-w-7xl py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
          <div className="premium-card p-6 sm:p-8">
            <span className="eyebrow">How it flows</span>
            <div className="mt-5 space-y-5">
              <h2 className="font-display text-3xl text-slate-950 sm:text-4xl">
                A clean path from source to answer.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Keep the workflow understandable for the team, whether the answer stays in the
                dashboard or ends up inside your own product.
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
                <h3 className="mt-3 font-display text-2xl text-white">Move from prototype to product</h3>
              </div>
              <div className="icon-shell h-12 w-12 border-white/10 bg-white/10 text-teal-300">
                <Braces className="h-5 w-5" />
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-white">
              Create a key, send a source, and reuse the same grounded workflow in your app through
              the REST API or embedded widgets.
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

      <section className="page-shell max-w-7xl py-10">
        <div className="section-intro">
          <span className="eyebrow">Run it your way</span>
          <h2 className="font-display text-4xl text-slate-950 sm:text-5xl">
            Pick the mode that matches your stack.
          </h2>
          <p className="max-w-3xl text-lg leading-8 text-slate-600">
            Start hosted, bring your own OpenAI and MongoDB, or move fully local with Ollama when
            the team needs tighter control.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {modeCards.map((mode) => (
            <article key={mode.title} className={`${mode.surfaceClass} p-7`}>
              <span className={`soft-pill ${mode.title === 'Local mode' ? 'border-white/10 bg-white/10 text-white' : 'bg-white/70 text-teal-700'}`}>
                {mode.eyebrow}
              </span>
              <div className="mt-5 flex items-center gap-3">
                <div className={`icon-shell h-12 w-12 ${mode.title === 'Local mode' ? 'border-white/10 bg-white/10 text-teal-300' : ''}`}>
                  <mode.icon className="h-5 w-5" />
                </div>
                <h3 className={`font-display text-3xl ${mode.title === 'Local mode' ? 'text-white' : 'text-slate-950'}`}>
                  {mode.title}
                </h3>
              </div>
              <p className={`mt-4 text-sm leading-7 ${mode.title === 'Local mode' ? 'text-slate-100' : 'text-slate-600'}`}>
                {mode.description}
              </p>
              <ul className={`mt-6 space-y-3 text-sm leading-7 ${mode.title === 'Local mode' ? 'text-slate-100' : 'text-slate-600'}`}>
                {mode.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <footer className="page-shell max-w-7xl py-10">
        <div className="premium-card flex flex-col items-center justify-between gap-6 px-6 py-7 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12 shrink-0" />
            <div>
              <p className="font-display text-xl text-slate-950">PDF Gyan</p>
              <p className="text-sm text-slate-500">Built on PageIndex for grounded document intelligence.</p>
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
