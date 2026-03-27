import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="page-shell py-16 sm:py-24">
      <div className="mx-auto max-w-3xl premium-card px-6 py-10 text-center sm:px-10">
        <span className="eyebrow">Page not found</span>
        <h1 className="font-display mt-6 text-5xl text-slate-950 sm:text-6xl">
          The page you were looking for is not here.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Try heading back to the main product overview, the blog, or the contact page.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-primary">
            Back to home
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/blog" className="btn-secondary">
            Browse blog
          </Link>
        </div>
      </div>
    </div>
  );
}
