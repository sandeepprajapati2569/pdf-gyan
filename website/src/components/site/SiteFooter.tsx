import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BrandMark from "@/components/site/BrandMark";
import { footerNavigation, siteConfig } from "@/lib/site-config";

export default function SiteFooter() {
  return (
    <footer className="page-shell pb-12 pt-8">
      <div className="premium-card flex flex-col gap-8 px-6 py-8 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12 shrink-0" />
            <div>
              <p className="font-display text-2xl text-slate-950">{siteConfig.name}</p>
              <p className="text-sm text-slate-500">Built on PageIndex for grounded document intelligence.</p>
            </div>
          </div>

          <p className="text-sm leading-7 text-slate-600">
            Upload PDFs, crawl websites, move through chat or voice, and reuse the same grounded
            workflow in your own product when the team is ready.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a href={`mailto:${siteConfig.contactEmail}`} className="btn-ghost text-sm">
              {siteConfig.contactEmail}
            </a>
            <a href={`${siteConfig.appUrl}/register`} className="btn-primary text-sm">
              Create workspace
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {footerNavigation.map((group) => (
            <div key={group.title}>
              <p className="section-kicker">{group.title}</p>
              <div className="mt-4 flex flex-col gap-3">
                {group.links.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} {siteConfig.name}. Calm tools for dense document work.
      </p>
    </footer>
  );
}
