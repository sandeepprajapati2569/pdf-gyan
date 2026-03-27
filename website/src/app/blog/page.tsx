import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionIntro from "@/components/site/SectionIntro";
import { blogPosts } from "@/lib/blog-posts";
import { formatLongDate } from "@/lib/formatters";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Read PDF Gyan guides and product notes about PDF chat, website knowledge, voice review, and deployment choices.",
};

export default function BlogIndexPage() {
  const [featuredPost, ...restPosts] = blogPosts;

  return (
    <div className="pb-8">
      <section className="page-shell py-10 sm:py-14">
        <SectionIntro
          eyebrow="Blog"
          title="Guides and product notes tied to the real workflow."
          description="These posts are written around the product we have today: grounded PDF chat, website crawl, voice review, team handoff, and deployment choices that affect actual adoption."
        />
      </section>

      <section className="page-shell py-4">
        <div className="premium-card overflow-hidden p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
            <div>
              <span className="soft-pill bg-white/80 text-teal-700">{featuredPost.category}</span>
              <p className="mt-5 text-sm font-semibold text-slate-500">
                {formatLongDate(featuredPost.publishedAt)} / {featuredPost.readTime}
              </p>
              <h2 className="mt-3 font-display text-4xl text-slate-950 sm:text-5xl">
                {featuredPost.title}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                {featuredPost.description}
              </p>
              <Link href={`/blog/${featuredPost.slug}`} className="btn-primary mt-6">
                Read featured post
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="soft-card p-5">
              <p className="section-kicker">Why this blog exists</p>
              <div className="mt-5 grid gap-3">
                {[
                  "Explain the product without generic AI filler.",
                  "Share rollout advice grounded in the actual feature set.",
                  "Give teams useful guidance before they enter the workspace.",
                ].map((item) => (
                  <div key={item} className="rounded-[20px] border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {restPosts.map((post, index) => (
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
              <span className="eyebrow border-white/10 bg-white/10 text-white">Want something more specific?</span>
              <h2 className="mt-5 font-display text-4xl text-white sm:text-5xl">
                Try the workflow with your own source or write to the team.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                The blog is useful for orientation. The best next step is still a real PDF, a real
                website, or a real product handoff question inside the workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href={`${siteConfig.appUrl}/register`} className="btn-primary">
                Start free
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/contact" className="btn-secondary border-white/10 bg-white/10 text-white hover:bg-white/14">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
