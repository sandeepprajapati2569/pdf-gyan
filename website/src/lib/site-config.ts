type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

type FooterGroup = {
  title: string;
  links: FooterLink[];
};

export const siteConfig = {
  name: "PDF Gyan",
  description:
    "PDF Gyan turns PDFs and websites into grounded answers your team can chat with, call through, share, and embed.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://pdfgyan.com",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://app.pdfgyan.com",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "noreply@pdfgyan.com",
};

export const mainNavigation = [
  { href: "/", label: "Product" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export const footerNavigation: FooterGroup[] = [
  {
    title: "Explore",
    links: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: `${siteConfig.appUrl}/register`, label: "Start free", external: true },
      { href: `${siteConfig.appUrl}/login`, label: "Sign in", external: true },
      { href: `${siteConfig.appUrl}/api-docs`, label: "API docs", external: true },
    ],
  },
];
