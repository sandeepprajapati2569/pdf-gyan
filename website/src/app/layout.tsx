import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "PDF Gyan | Grounded document intelligence",
    template: "%s | PDF Gyan",
  },
  description: siteConfig.description,
  keywords: [
    "PDF chat",
    "document intelligence",
    "chat with PDF",
    "website crawler",
    "voice document assistant",
    "document AI",
    "RAG workspace",
    "knowledge base",
    "embeddable AI widgets",
  ],
  openGraph: {
    title: "PDF Gyan | Grounded document intelligence",
    description: siteConfig.description,
    type: "website",
    siteName: siteConfig.name,
    url: siteConfig.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF Gyan | Grounded document intelligence",
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${sora.variable}`}>
      <body>
        <div className="relative flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
