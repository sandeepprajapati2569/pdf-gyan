import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Braces,
  FileStack,
  FileText,
  Globe,
  Layers3,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

export type IconCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
};

export const heroPills = [
  "PDF upload",
  "Website crawl",
  "Voice call",
  "API + widgets",
];

export const homeMetrics = [
  {
    value: "2,000",
    label: "website pages supported per crawl",
  },
  {
    value: "3",
    label: "deployment paths: hosted, private, and local",
  },
  {
    value: "1",
    label: "workspace for PDFs, websites, chat, call, and handoff",
  },
];

export const capabilityCards: IconCard[] = [
  {
    icon: FileStack,
    eyebrow: "Grounded retrieval",
    title: "Keep answers tied to the source",
    description:
      "Index PDFs with structure intact so teams can keep asking follow-up questions without losing the document context.",
  },
  {
    icon: Globe,
    eyebrow: "Website crawl",
    title: "Bring live knowledge sites into the same workspace",
    description:
      "Crawl help centers, docs portals, or public knowledge hubs and work with them beside uploaded files.",
  },
  {
    icon: Phone,
    eyebrow: "Voice review",
    title: "Switch to call mode when speaking is faster than typing",
    description:
      "Move dense review sessions into voice while keeping the interaction grounded in the same document context.",
  },
  {
    icon: Braces,
    eyebrow: "Product handoff",
    title: "Reuse the workflow in your own product",
    description:
      "Generate API keys, create embed tokens, and move from internal testing to customer-facing experiences without rebuilding from scratch.",
  },
  {
    icon: Users,
    eyebrow: "Team workspaces",
    title: "Share knowledge with the right people",
    description:
      "Invite teammates with clear roles, share documents into team spaces, and keep collaborative review inside one product.",
  },
  {
    icon: BarChart3,
    eyebrow: "Visibility",
    title: "Track how the workspace is actually used",
    description:
      "Use analytics and recent thread views to see what content is getting questions and where the workflow is active.",
  },
];

export const workflowSteps = [
  {
    step: "01",
    title: "Bring in the source",
    description:
      "Upload a PDF or crawl a website, then let the workspace move it from processing to ready with a clear status.",
  },
  {
    step: "02",
    title: "Work through chat or voice",
    description:
      "Ask direct questions, compare sources, or switch to a call flow when the review is faster spoken than typed.",
  },
  {
    step: "03",
    title: "Share or embed the result",
    description:
      "Pass the same grounded workflow to teammates, share a conversation, or take it into your own product through the API and widgets.",
  },
];

export const developerQuickstart = [
  {
    icon: ShieldCheck,
    title: "Create a workspace key",
    description:
      "Use one clean auth layer for upload, chat, and embedded product flows.",
  },
  {
    icon: Globe,
    title: "Send a PDF or crawl a website",
    description:
      "Prepare the source once so every follow-up question can reuse the same grounded base.",
  },
  {
    icon: Workflow,
    title: "Return answers where users already work",
    description:
      "Keep the document workflow in your dashboard, your customer experience, or both.",
  },
];

export const useCases: IconCard[] = [
  {
    icon: Layers3,
    title: "Research and due diligence",
    description:
      "Compare contracts, policy documents, product notes, and external knowledge sites without rebuilding the question each time.",
  },
  {
    icon: Sparkles,
    title: "Customer support and enablement",
    description:
      "Pull answers from manuals, help center content, and internal reference files so support teams can move faster with fewer tab switches.",
  },
  {
    icon: Bot,
    title: "Internal knowledge copilots",
    description:
      "Create a calmer workspace for teams that live inside long PDFs, implementation docs, or recurring process references.",
  },
  {
    icon: FileText,
    title: "Productized document experiences",
    description:
      "Turn the same grounded workflow into embedded chat or voice experiences for customers when the internal flow proves valuable.",
  },
];

export const deploymentModes = [
  {
    icon: Sparkles,
    eyebrow: "Fastest setup",
    title: "Hosted mode",
    description:
      "Use the managed path when the goal is to launch quickly and validate the workflow with the least operational overhead.",
    bullets: [
      "Best for the quickest start",
      "Strong fit for pilots and product teams",
      "Lets the team focus on workflow adoption first",
    ],
    dark: false,
  },
  {
    icon: ShieldCheck,
    eyebrow: "Bring your own stack",
    title: "Private mode",
    description:
      "Keep new uploads and conversations closer to your own data path by using your OpenAI key and MongoDB.",
    bullets: [
      "Your OpenAI usage stays in your control",
      "MongoDB can live in your own environment",
      "Keeps the product flow intact for end users",
    ],
    dark: false,
  },
  {
    icon: Bot,
    eyebrow: "Local-first",
    title: "Local mode",
    description:
      "Run with Ollama and MongoDB when the team needs a more local inference path without giving up the workspace experience.",
    bullets: [
      "Local inference with Ollama",
      "Fits teams that need tighter control",
      "Useful for experimentation and regulated workflows",
    ],
    dark: true,
  },
];

export const aboutPrinciples: IconCard[] = [
  {
    icon: FileStack,
    title: "Grounded over generic",
    description:
      "The product is built to keep answers close to the source instead of polishing over uncertainty with broad summaries.",
  },
  {
    icon: Workflow,
    title: "One workflow from internal use to product handoff",
    description:
      "The same upload, chat, and call loop should still make sense when it moves into shared links, APIs, or widgets.",
  },
  {
    icon: ShieldCheck,
    title: "Control should match the team, not fight it",
    description:
      "Hosted, private, and local modes exist so infrastructure requirements do not force a totally different user experience.",
  },
  {
    icon: Users,
    title: "Dense document work should feel calm",
    description:
      "The interface is designed to reduce friction for teams who spend real time with specs, policies, and long-form reference material.",
  },
];

export const faqItems = [
  {
    question: "Can PDF Gyan work with websites as well as PDFs?",
    answer:
      "Yes. The workspace supports website crawling with include and exclude patterns, crawl depth controls, and indexing for grounded follow-up questions.",
  },
  {
    question: "Can we keep our own infrastructure in the loop?",
    answer:
      "Yes. Teams can choose hosted mode, private mode with their own OpenAI key and MongoDB, or local mode with Ollama and MongoDB.",
  },
  {
    question: "Can this move beyond the dashboard?",
    answer:
      "Yes. PDF Gyan supports API keys, embeddable chat and call widgets, and shared conversations so the workflow can extend into your product.",
  },
  {
    question: "Is it built for teams or just single-user testing?",
    answer:
      "It is built for both. The product includes team workspaces, member roles, sharing flows, and analytics so teams can collaborate around the same source base.",
  },
];

export const contactReasons = [
  {
    icon: Sparkles,
    title: "Product walkthrough",
    description:
      "Talk through your documents, your website content, and the workflow you want to improve first.",
    subject: "PDF Gyan product walkthrough",
  },
  {
    icon: Braces,
    title: "Integration planning",
    description:
      "Get help deciding when to stay in the dashboard, when to use the API, and when an embedded widget makes more sense.",
    subject: "PDF Gyan integration planning",
  },
  {
    icon: ShieldCheck,
    title: "Security and deployment",
    description:
      "Ask about hosted, private, or local rollout paths and how to line them up with your team requirements.",
    subject: "PDF Gyan security and deployment question",
  },
  {
    icon: Users,
    title: "Support and onboarding",
    description:
      "Reach out when the team needs help with setup, source organization, sharing, or getting to a reliable first workflow.",
    subject: "PDF Gyan onboarding and support",
  },
];

export const contactChecklist = [
  "What kind of source you are working with: PDFs, websites, or both.",
  "Who the workflow is for: internal teams, customers, or a mixed handoff.",
  "Whether you want hosted, private, or local deployment.",
  "Any sample question the team keeps asking today.",
];
