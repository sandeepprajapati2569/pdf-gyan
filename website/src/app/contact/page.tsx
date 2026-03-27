import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MessageSquareQuote } from "lucide-react";
import SectionIntro from "@/components/site/SectionIntro";
import { contactChecklist, contactReasons } from "@/lib/site-data";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with PDF Gyan for walkthroughs, integration planning, deployment questions, or onboarding help.",
};

function buildMailto(subject: string) {
  return `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(subject)}`;
}

export default function ContactPage() {
  return (
    <div className="pb-8">
      <section className="page-shell py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)] lg:items-start">
          <div className="space-y-6">
            <span className="eyebrow">Contact</span>
            <h1 className="font-display max-w-4xl text-5xl leading-[1.04] text-slate-950 sm:text-6xl">
              Reach the team with the workflow you want to improve.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-600">
              Use this page for product walkthroughs, integration planning, deployment questions,
              and onboarding help. The most useful conversations usually start with one real source
              and one real question your team is already asking.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={buildMailto("PDF Gyan inquiry")} className="btn-primary">
                <Mail className="h-4 w-4" />
                Email the team
              </a>
              <a href={`${siteConfig.appUrl}/register`} className="btn-secondary">
                Create workspace
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="premium-card p-6 sm:p-7">
            <p className="section-kicker">Current inbox</p>
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="mt-4 inline-flex items-center gap-3 text-lg font-semibold text-slate-950"
            >
              <Mail className="h-5 w-5 text-teal-700" />
              {siteConfig.contactEmail}
            </a>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              If you already know the source material you want to test, mention whether it is a PDF,
              a website, or a mix of both. That makes it much easier to point you toward the right setup.
            </p>
            <div className="mt-6 rounded-[24px] border border-teal-100 bg-teal-50/70 p-4">
              <p className="text-sm font-semibold text-teal-800">
                Best first message: tell us the source type, the team using it, and whether you want
                hosted, private, or local rollout.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-10">
        <SectionIntro
          eyebrow="How we can help"
          title="Common reasons teams reach out."
          description="The website now includes a real contact surface, so these paths make it clear what kinds of conversations belong here."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {contactReasons.map((reason, index) => (
            <article
              key={reason.title}
              className="premium-card animate-rise flex h-full flex-col p-6"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="icon-shell h-12 w-12">
                <reason.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{reason.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{reason.description}</p>
              <a
                href={buildMailto(reason.subject)}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"
              >
                Start this conversation
                <ArrowRight className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
          <div className="premium-card p-6 sm:p-8">
            <SectionIntro
              eyebrow="Make the first note useful"
              title="What to include when you write."
              description="A little context on the first message makes it much easier to suggest the right product path instead of starting from generic setup advice."
            />

            <div className="mt-8 grid gap-3">
              {contactChecklist.map((item, index) => (
                <div key={item} className="soft-card flex items-start gap-4 px-4 py-4">
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-card p-6 sm:p-8">
            <p className="section-kicker">Useful before or after contact</p>
            <h2 className="mt-4 font-display text-3xl text-slate-950">
              Quick paths if you want to keep moving right now.
            </h2>

            <div className="mt-6 grid gap-3">
              <a href={`${siteConfig.appUrl}/api-docs`} className="soft-card px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">API docs</p>
                <p className="mt-1 text-sm leading-7 text-slate-600">
                  Check the current upload, chat, and integration surfaces.
                </p>
              </a>
              <Link href="/blog" className="soft-card px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">Blog guides</p>
                <p className="mt-1 text-sm leading-7 text-slate-600">
                  Read product-specific notes on PDFs, websites, voice review, and deployment choices.
                </p>
              </Link>
              <Link href="/about" className="soft-card px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">About the product</p>
                <p className="mt-1 text-sm leading-7 text-slate-600">
                  See the principles shaping the current workflow and positioning.
                </p>
              </Link>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <MessageSquareQuote className="mt-0.5 h-5 w-5 text-amber-600" />
                <p className="text-sm leading-7 text-slate-600">
                  A strong first evaluation is usually one PDF, one website, or one support workflow
                  your team already knows well. That gives the product something concrete to prove.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
