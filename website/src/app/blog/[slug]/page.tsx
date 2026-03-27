import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { blogPosts, getBlogPost } from "@/lib/blog-posts";
import { formatLongDate } from "@/lib/formatters";
import { siteConfig } from "@/lib/site-config";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: "Blog",
    };
  }

  return {
    title: post.title,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = blogPosts.filter((entry) => entry.slug !== post.slug).slice(0, 2);

  return (
    <div className="pb-8">
      <section className="page-shell py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="soft-pill bg-white/80 text-teal-700">{post.category}</span>
            <span className="text-sm font-semibold text-slate-500">
              {formatLongDate(post.publishedAt)} / {post.readTime}
            </span>
          </div>

          <h1 className="font-display mt-6 text-5xl leading-[1.04] text-slate-950 sm:text-6xl">
            {post.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">{post.intro}</p>

          <div className="premium-card mt-8 p-6">
            <p className="section-kicker">Key takeaways</p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              {post.keyTakeaways.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="page-shell py-4">
        <div className="mx-auto max-w-4xl">
          <article className="premium-card p-6 sm:p-8">
            <div className="article-body">
              {post.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                  {section.note ? <div className="article-note">{section.note}</div> : null}
                </section>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="mx-auto max-w-4xl premium-card-dark p-8 text-slate-100 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <span className="eyebrow border-white/10 bg-white/10 text-white">Try the real workflow</span>
              <h2 className="mt-5 font-display text-4xl text-white sm:text-5xl">
                Put one of these ideas against your own source material.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                Blog guidance is useful, but the product proves itself fastest when the team brings
                in the PDF, website, or customer workflow they already depend on.
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

      <section className="page-shell py-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">More reading</p>
              <h2 className="font-display mt-3 text-3xl text-slate-950">Related posts</h2>
            </div>
            <Link href="/blog" className="btn-ghost text-sm">
              All posts
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {relatedPosts.map((entry) => (
              <article key={entry.slug} className="premium-card flex h-full flex-col p-6">
                <span className="soft-pill w-fit bg-white/80 text-teal-700">{entry.category}</span>
                <p className="mt-4 text-sm font-semibold text-slate-500">
                  {formatLongDate(entry.publishedAt)} / {entry.readTime}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-slate-950">{entry.title}</h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">{entry.description}</p>
                <Link href={`/blog/${entry.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                  Read article
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
