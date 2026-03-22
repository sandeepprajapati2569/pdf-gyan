import { Link } from 'react-router-dom'
import { ArrowRight, ChartSpline, ShieldCheck, Workflow } from 'lucide-react'
import BrandMark from './BrandMark'

const highlights = [
  {
    icon: Workflow,
    title: 'Grounded answers',
    description: 'Ask naturally and get clear responses from your documents.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by choice',
    description: 'Use your own key and keep control of how your workspace runs.',
  },
  {
    icon: ChartSpline,
    title: 'Ready for teams',
    description: 'Upload once, chat fast, and move from docs to decisions quicker.',
  },
]

export default function AuthFrame({
  eyebrow,
  title,
  subtitle,
  footerPrompt,
  footerLinkTo,
  footerLinkText,
  children,
}) {
  return (
    <div className="page-shell max-w-7xl py-8 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
        <section className="premium-card relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute right-[-5rem] top-[-4rem] h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-[-2rem] h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />

          <div className="relative space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/72 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <BrandMark className="h-10 w-10 shrink-0" />
              <div>
                <p className="font-display text-base text-slate-950">PDF Gyan</p>
                <p className="text-xs text-slate-500">Document intelligence for serious workflows</p>
              </div>
            </div>

            <div className="space-y-4">
              <span className="eyebrow">Focused workspace</span>
              <h1 className="font-display text-4xl leading-tight text-slate-950 xl:text-5xl">
                Trust your documents. Move faster.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-600">
                One calm place to upload PDFs, ask questions, and keep work moving.
              </p>
            </div>

            <div className="grid gap-4">
              {highlights.map((item, index) => (
                <div
                  key={item.title}
                  className="premium-card animate-rise flex items-start gap-4 p-4"
                  style={{ animationDelay: `${index * 110}ms` }}
                >
                  <div className="icon-shell h-11 w-11 shrink-0">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

        <section className="premium-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-teal-200/20 blur-3xl" />

          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {eyebrow}
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">
                {title}
              </h2>
              <p className="max-w-lg text-base leading-7 text-slate-600 sm:text-lg">{subtitle}</p>
            </div>

            <div>{children}</div>

            <div className="border-t border-slate-200/80 pt-5 text-sm text-slate-500">
              {footerPrompt}{' '}
              <Link
                to={footerLinkTo}
                className="inline-flex items-center gap-1 font-semibold text-teal-700 transition hover:text-teal-800"
              >
                {footerLinkText}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
