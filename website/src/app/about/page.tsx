import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import SectionIntro from "@/components/site/SectionIntro";
import {
  aboutPrinciples,
  capabilityCards,
  deploymentModes,
  workflowSteps,
} from "@/lib/site-data";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how PDF Gyan approaches grounded document intelligence for PDFs, websites, voice review, and product handoff.",
};

export default function AboutPage() {
  return (
    <div className="pb-8">
      <section className="page-shell py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)] lg:items-start">
          <div className="space-y-6">
            <span className="eyebrow">About PDF Gyan</span>
            <h1 className="font-display max-w-4xl text-5xl leading-[1.04] text-slate-950 sm:text-6xl">
              Built for teams who need answers they can go back and verify.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-600">
              PDF Gyan is a document intelligence product for teams working with long PDFs,
              knowledge sites, and repeat questions that need grounded answers instead of polished guesswork.
              The goal is simple: make dense source material easier to work through, easier to share,
              and easier to turn into product experiences later.
            </p>
            <p className="max-w-3xl text-lg leading-8 text-slate-600">
              We care about the handoff as much as the first answer. That means the workspace should
              still hold up when the conversation moves to a teammate, to a call, or into your own app.
            </p>
          </div>

          <div className="premium-card p-6 sm:p-7">
            <p className="section-kicker">What the product already supports</p>
            <div className="mt-5 grid gap-3">
              {[
                "PDF uploads with readiness state",
                "Website crawling with include and exclude patterns",
                "Chat and voice review in the same workspace",
                "Shared conversations, team roles, and analytics",
                "API keys and embeddable chat or call widgets",
              ].map((item) => (
                <div key={item} className="soft-card px-4 py-3 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={`${siteConfig.appUrl}/register`} className="btn-primary text-sm">
                Create workspace
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/contact" className="btn-secondary text-sm">
                Contact us
                <Phone className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-10">
        <SectionIntro
          eyebrow="How we think"
          title="Product principles that keep the workflow useful."
          description="The site and the product should say the same thing. These are the ideas shaping the experience today."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {aboutPrinciples.map((card, index) => (
            <article
              key={card.title}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 80}ms` }}
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

      <section className="page-shell py-10">
        <SectionIntro
          eyebrow="Inside the platform"
          title="The product is broader than a single PDF chat box."
          description="PDF Gyan combines multiple ways of working with source material so teams can stay in one product instead of stitching tools together by hand."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {capabilityCards.map((card, index) => (
            <article
              key={card.title}
              className="premium-card animate-rise p-6"
              style={{ animationDelay: `${index * 80}ms` }}
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
            <SectionIntro
              eyebrow="What makes the workflow different"
              title="Source, answer, and handoff stay connected."
              description="The system is meant to support how real document work unfolds: bring in the source, ask the next question, then reuse what worked."
            />

            <div className="mt-8 space-y-4">
              {workflowSteps.map((step, index) => (
                <article
                  key={step.step}
                  className="soft-card animate-rise p-5"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-950 px-3 text-sm font-bold tracking-[0.18em] text-white">
                      {step.step}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="premium-card-dark p-6 text-slate-100 sm:p-8">
            <p className="section-kicker text-slate-300">Why teams keep evaluating it</p>
            <h2 className="mt-4 font-display text-3xl text-white">
              The deployment path does not force a different product story.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-100">
              Teams can start with the mode that clears their next blocker and keep the same
              core workflow around source grounding, voice review, and product handoff.
            </p>

            <div className="mt-6 space-y-4">
              {deploymentModes.map((mode) => (
                <div key={mode.title} className="rounded-[24px] border border-white/12 bg-white/6 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">
                    {mode.eyebrow}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{mode.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-100">{mode.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-12">
        <div className="premium-card-dark p-8 text-slate-100 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <span className="eyebrow border-white/10 bg-white/10 text-white">Next step</span>
              <h2 className="mt-5 font-display text-4xl text-white sm:text-5xl">
                Use the site as the overview, then try the real workflow with your own sources.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                The website now tells the product story clearly. The quickest way to validate the
                product itself is still to bring in the source material your team already depends on.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href={`${siteConfig.appUrl}/register`} className="btn-primary">
                Start free
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/blog" className="btn-secondary border-white/10 bg-white/10 text-white hover:bg-white/14">
                Read the blog
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
