import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Braces,
  Globe,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import SectionIntro from "@/components/site/SectionIntro";
import { featuredBlogPosts } from "@/lib/blog-posts";
import { formatLongDate } from "@/lib/formatters";
import {
  capabilityCards,
  deploymentModes,
  developerQuickstart,
  faqItems,
  heroPills,
  homeMetrics,
  useCases,
  workflowSteps,
} from "@/lib/site-data";
import { siteConfig } from "@/lib/site-config";

export default function Home() {
  return (
    <div className="pb-8">
      <section className="page-shell pb-8 pt-10 sm:pt-14">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <div className="animate-rise space-y-7">
            <span className="eyebrow">Grounded document intelligence</span>

            <div className="space-y-5">
              <h1 className="font-display max-w-4xl text-5xl leading-[1.02] text-slate-950 sm:text-6xl xl:text-7xl">
                Turn PDFs and websites into answers your team can actually use.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                PDF Gyan brings upload, website crawl, chat, voice review, shared handoff, and
                product embedding into one calm workspace built for dense source material.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a href={`${siteConfig.appUrl}/register`} className="btn-primary">
                <Sparkles className="h-4 w-4" />
                Start free
              </a>
              <Link href="/blog" className="btn-secondary">
                Read the blog
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {heroPills.map((item) => (
                <span key={item} className="soft-pill text-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="premium-card animate-rise relative overflow-hidden p-5 sm:p-7" style={{ animationDelay: "120ms" }}>
            <div className="ambient-grid absolute inset-0 opacity-60" />
            <div className="animate-drift absolute right-[-3rem] top-[-2rem] h-40 w-40 rounded-full bg-teal-300/18 blur-3xl" />
            <div className="animate-drift absolute bottom-[-4rem] left-[-1rem] h-48 w-48 rounded-full bg-amber-200/28 blur-3xl" />

            <div className="relative space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-3 py-2">
                  <div className="icon-shell h-10 w-10 shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-display text-sm text-slate-950">Live workspace</p>
                    <p className="text-xs text-slate-500">One place for source, answer, and handoff</p>
                  </div>
                </div>
                <span className="soft-pill">
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  Source aware
                </span>
              </div>

              <div className="soft-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-shell h-12 w-12">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">docs.acme.com</p>
                      <p className="text-sm text-slate-500">418 pages ready beside quarterly-review.pdf</p>
                    </div>
                  </div>
                  <span className="soft-pill bg-emerald-50 text-emerald-700">Ready</span>
                </div>

                <div className="mt-5 rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,251,250,0.82))] p-4 shadow-[0_20px_42px_rgba(15,23,42,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live thread</p>

                  <div className="mt-4 flex justify-end">
                    <div className="max-w-[90%] rounded-[22px] bg-slate-950 px-5 py-4 text-slate-100 shadow-[0_20px_36px_rgba(15,23,42,0.18)]">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Question</p>
                      <p className="mt-3 text-sm leading-7 text-slate-200">
                        What changed between the new product guide and the public docs that customer
                        support needs to know first?
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
                        The updated guide adds role-specific setup steps, changes the renewal flow,
                        and introduces a voice handoff option that is not yet reflected in the public docs.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {["Cross-source comparison", "Thread saved", "Voice follow-up ready"].map((tag) => (
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
      </section>

      <section className="page-shell py-8">
        <div className="grid gap-4 md:grid-cols-3">
          {homeMetrics.map((item, index) => (
            <article
              key={item.label}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="font-display text-4xl text-slate-950">{item.value}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="product" className="page-shell py-10">
        <SectionIntro
          eyebrow="What the product gives you"
          title="A workspace that stays useful after the first upload."
          description="The product is designed for real document work: grounded answers, live website knowledge, voice review, team handoff, and a clean path into your own application."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {capabilityCards.map((card, index) => (
            <article
              key={card.title}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="icon-shell h-12 w-12">
                <card.icon className="h-5 w-5" />
              </div>
              <p className="mt-5 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-400">
                {card.eyebrow}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
          <div className="premium-card p-6 sm:p-8">
            <span className="eyebrow">How it flows</span>
            <div className="mt-5 space-y-5">
              <h2 className="font-display text-3xl text-slate-950 sm:text-4xl">
                A cleaner path from source to answer.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                The product keeps the workflow legible whether the answer stays inside the dashboard
                or ends up inside your own app.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {workflowSteps.map((step, index) => (
                <article
                  key={step.step}
                  className="premium-card animate-rise relative overflow-hidden p-4 sm:p-5"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-500/80 via-sky-500/60 to-amber-400/70" />
                  <div className="flex items-start gap-4 sm:gap-5">
                    <div className="shrink-0 pt-0.5">
                      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-950 px-3 text-sm font-bold tracking-[0.18em] text-white shadow-[0_14px_24px_rgba(15,23,42,0.14)]">
                        {step.step}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-950 sm:text-lg">{step.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[0.95rem]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="premium-card-dark overflow-hidden p-6 text-slate-100 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-100">Developer quickstart</p>
                <h3 className="mt-3 font-display text-2xl text-white">Move from prototype to product</h3>
              </div>
              <div className="icon-shell h-12 w-12 border-white/10 bg-white/10 text-teal-300">
                <Braces className="h-5 w-5" />
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-100">
              Keep the same grounded workflow across internal testing, embedded customer flows, and
              API-driven product experiences.
            </p>

            <div className="mt-6 space-y-3">
              {developerQuickstart.map((item, index) => (
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
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-100">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <pre className="mt-6 overflow-x-auto rounded-[22px] border border-white/14 bg-black/30 p-4 text-sm text-white">
{`curl -X POST \\
  -H "Authorization: Bearer pgyan_YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  ${siteConfig.appUrl}/api/v1/documents/upload`}
            </pre>

            <a
              href={`${siteConfig.appUrl}/api-docs`}
              className="btn-secondary mt-6 w-full justify-center border-white/10 bg-white/10 text-white hover:bg-white/14"
            >
              Explore the API
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="page-shell py-10">
        <SectionIntro
          eyebrow="Where teams use it"
          title="Useful for dense work, not just flashy demos."
          description="PDF Gyan fits teams who need answers they can verify, reuse, and pass along. The workflow is designed to help people stay inside the source instead of just skimming around it."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {useCases.map((card, index) => (
            <article
              key={card.title}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className={`icon-shell h-12 w-12 ${index % 2 === 1 ? "icon-shell-warm" : ""}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-10">
        <SectionIntro
          eyebrow="Run it your way"
          title="Choose the deployment path that matches your team."
          description="Start with the fastest setup, use your own OpenAI and MongoDB when needed, or move local with Ollama. The workflow stays familiar across all three."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {deploymentModes.map((mode) => (
            <article
              key={mode.title}
              className={`${mode.dark ? "premium-card-dark text-slate-100" : "premium-card"} p-7`}
            >
              <span
                className={`soft-pill ${
                  mode.dark ? "border-white/10 bg-white/10 text-white" : "bg-white/70 text-teal-700"
                }`}
              >
                {mode.eyebrow}
              </span>
              <div className="mt-5 flex items-center gap-3">
                <div className={`icon-shell h-12 w-12 ${mode.dark ? "border-white/10 bg-white/10 text-teal-300" : ""}`}>
                  <mode.icon className="h-5 w-5" />
                </div>
                <h3 className={`font-display text-3xl ${mode.dark ? "text-white" : "text-slate-950"}`}>
                  {mode.title}
                </h3>
              </div>
              <p className={`mt-4 text-sm leading-7 ${mode.dark ? "text-slate-100" : "text-slate-600"}`}>
                {mode.description}
              </p>
              <ul className={`mt-6 space-y-3 text-sm leading-7 ${mode.dark ? "text-slate-100" : "text-slate-600"}`}>
                {mode.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-10">
        <SectionIntro
          eyebrow="Questions teams ask first"
          title="The basics, answered clearly."
          description="The site should tell people what the product can do without making them guess. These are the questions that usually come up first."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {faqItems.map((item, index) => (
            <article
              key={item.question}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <h3 className="text-xl font-semibold text-slate-950">{item.question}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionIntro
            eyebrow="From the blog"
            title="Guides and product notes tied to the actual workflow."
            description="The new blog is focused on how teams use grounded document intelligence in practice: PDFs, websites, voice review, and deployment choices."
          />
          <Link href="/blog" className="btn-ghost shrink-0 text-sm">
            View all posts
          </Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {featuredBlogPosts.map((post, index) => (
            <article
              key={post.slug}
              className="premium-card animate-rise flex h-full flex-col p-6"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="soft-pill bg-white/80 text-teal-700">{post.category}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {post.readTime}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                {formatLongDate(post.publishedAt)}
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">{post.title}</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">{post.description}</p>
              <Link href={`/blog/${post.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                Read article
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-12">
        <div className="premium-card-dark p-8 text-slate-100 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <span className="eyebrow border-white/10 bg-white/10 text-white">Ready to try it with your own sources?</span>
              <h2 className="mt-5 font-display text-4xl text-white sm:text-5xl">
                Start with one PDF, one website, or one real team question.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                The fastest way to evaluate PDF Gyan is to use the source material your team already
                depends on and see how the workflow holds up across chat, call, and handoff.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href={`${siteConfig.appUrl}/register`} className="btn-primary">
                Start free
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/contact" className="btn-secondary border-white/10 bg-white/10 text-white hover:bg-white/14">
                Talk to the team
                <Phone className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
