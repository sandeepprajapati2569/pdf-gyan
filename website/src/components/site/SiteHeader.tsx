import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BrandMark from "@/components/site/BrandMark";
import { mainNavigation, siteConfig } from "@/lib/site-config";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-shell py-4">
        <div className="premium-card flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-11 w-11 shrink-0" />
            <div>
              <p className="font-display text-xl text-slate-950">{siteConfig.name}</p>
              <p className="text-sm text-slate-500">Grounded document intelligence</p>
            </div>
          </Link>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <nav className="flex flex-wrap items-center gap-2 lg:justify-center">
              {mainNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/70 hover:text-slate-950"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`${siteConfig.appUrl}/api-docs`}
                className="btn-secondary text-sm"
              >
                API docs
              </a>
              <a
                href={`${siteConfig.appUrl}/register`}
                className="btn-primary text-sm"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
