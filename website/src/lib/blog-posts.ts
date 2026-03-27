export type BlogPostSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  note?: string;
};

export type BlogPost = {
  slug: string;
  category: string;
  title: string;
  description: string;
  publishedAt: string;
  readTime: string;
  author: string;
  intro: string;
  keyTakeaways: string[];
  sections: BlogPostSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "hosted-private-or-local-which-pdf-gyan-setup-fits-your-team",
    category: "Deployment",
    title: "Hosted, private, or local: which PDF Gyan setup fits your team?",
    description:
      "A practical way to choose between the fastest rollout, your own stack, or a fully local setup without rewriting your workflow later.",
    publishedAt: "2026-03-24",
    readTime: "7 min read",
    author: "PDF Gyan Team",
    intro:
      "Teams rarely fail to adopt document intelligence because they dislike the idea. They fail because the deployment path does not match the way security, procurement, and engineering already work. PDF Gyan supports three operating modes so you can pick the right level of control without changing the product your users see.",
    keyTakeaways: [
      "Use hosted mode when speed matters more than infrastructure ownership.",
      "Use private mode when you want your own OpenAI key and MongoDB behind the same workflow.",
      "Use local mode when a team needs Ollama-based inference and local-first control.",
      "The user-facing flow stays familiar across all three options.",
    ],
    sections: [
      {
        heading: "Start with the workflow, not the infrastructure diagram",
        paragraphs: [
          "The wrong way to choose a setup is to begin with an abstract debate about cloud versus local. The better question is what your team needs to do every day. If people need to upload PDFs, crawl websites, ask grounded questions, and hand the same flow into a widget or API, the deployment decision should preserve that experience instead of fragmenting it.",
          "That is why PDF Gyan keeps the product shape consistent. The same workspace idea stays in place whether you need the fastest hosted launch, a private data path with your own keys, or a local mode driven by Ollama.",
        ],
      },
      {
        heading: "Hosted mode is for teams that want momentum quickly",
        paragraphs: [
          "Hosted mode is the cleanest path when the goal is to get value fast. Teams can upload PDFs, crawl knowledge sites, test voice interactions, and validate how grounded answers change daily work without first standing up new infrastructure.",
          "This path is usually strongest for product teams, pilots, support operations, and internal knowledge rollouts where time-to-first-result matters more than deep platform customization on day one.",
        ],
        bullets: [
          "Best when you want the quickest start.",
          "Good for product validation and early rollouts.",
          "Keeps ops overhead low while the workflow proves itself.",
        ],
      },
      {
        heading: "Private mode is for teams that need a clearer ownership boundary",
        paragraphs: [
          "Some teams are comfortable with cloud software, but still want tighter control over where new data lives and how model usage is billed. Private mode fits that middle ground. You can keep your own OpenAI key and MongoDB in the loop while still using the same PDF Gyan workflow for upload, chat, call, sharing, and embedding.",
          "That makes private mode a strong fit when security reviews are real, but the team still wants a managed product experience instead of rebuilding document chat as an internal project.",
        ],
        bullets: [
          "Your OpenAI account stays in your control.",
          "MongoDB can live in your own environment.",
          "Users still see the same product flow instead of a separate internal tool.",
        ],
      },
      {
        heading: "Local mode is for teams that need the tightest control",
        paragraphs: [
          "Local mode matters when data handling requirements or development preferences push the team toward local-first inference. In PDF Gyan, that means pairing MongoDB storage with Ollama-based model execution while keeping the workflow recognizable for the user.",
          "Local mode is especially useful for experimentation, regulated workflows, and engineering teams that want to stay closer to the metal without losing the higher-level product experience around the model.",
        ],
        note:
          "The point of local mode is not novelty. It is giving teams an option when hosted or externally keyed inference is the wrong fit.",
      },
      {
        heading: "Choose the mode that removes the next blocker",
        paragraphs: [
          "If the blocker is speed, use hosted mode. If the blocker is data ownership, use private mode. If the blocker is infrastructure policy or local-first preference, use local mode. The important part is that none of those choices should force the team to give up grounded retrieval, voice review, website crawling, or product handoff through the API and widgets.",
          "Good deployment choices reduce friction. They should not create a second product to maintain.",
        ],
      },
    ],
  },
  {
    slug: "build-one-knowledge-base-from-pdfs-and-websites",
    category: "Guides",
    title: "Build one knowledge base from PDFs and websites",
    description:
      "How to stop splitting knowledge between file uploads and docs portals, and instead answer from both in one grounded workflow.",
    publishedAt: "2026-03-20",
    readTime: "6 min read",
    author: "PDF Gyan Team",
    intro:
      "Most teams do not have a single knowledge source. Important answers are scattered between PDFs, policy files, implementation notes, help centers, and long documentation sites. If your workflow only understands one of those formats, people still spend their day switching tabs and reconstructing the story manually.",
    keyTakeaways: [
      "The best knowledge workflow combines uploaded files and live websites.",
      "Crawl scope matters as much as crawl capability.",
      "A shared workspace is more useful than a pile of disconnected indexes.",
      "Comparing across sources is where real operational value shows up.",
    ],
    sections: [
      {
        heading: "Why file-only workflows break down",
        paragraphs: [
          "PDFs are where many teams start because the format is dense, static, and painful to search manually. But as soon as a team depends on product docs, support centers, or a public help site, a file-only workflow becomes partial knowledge. Users get one answer from the upload tool and another from the browser.",
          "The result is not just inconvenience. It is confidence loss. People stop trusting that one workspace contains the whole picture.",
        ],
      },
      {
        heading: "Crawl the site you actually need, not the internet",
        paragraphs: [
          "A good website crawl is selective. You want the product docs, onboarding flows, release notes, and policy pages that matter to the team. You do not want a brittle system clogged with every marketing page, archive, or duplicate route.",
          "PDF Gyan supports include and exclude patterns, crawl depth, and website indexing in the same product flow, which helps teams decide what should belong in the working knowledge base before they ask questions against it.",
        ],
        bullets: [
          "Start with the pages the team already references in meetings.",
          "Keep the crawl boundary explicit so the resulting answers stay interpretable.",
          "Expand only when the current scope proves useful.",
        ],
      },
      {
        heading: "Unify the workspace so follow-up questions stay cheap",
        paragraphs: [
          "The advantage of one workspace is not only that sources are present. It is that a user can ask a follow-up question without mentally rebuilding the source list every time. They can move from a product spec PDF to a docs site article, or compare the two, without changing tools.",
          "That is where grounded document intelligence starts to feel practical instead of impressive. It reduces the switching cost between source types.",
        ],
      },
      {
        heading: "The real value is in comparison and handoff",
        paragraphs: [
          "Once PDFs and websites sit inside the same workspace, teams can compare statements, spot gaps, and answer questions that cross boundaries. That is useful for support, onboarding, audits, pre-sales, and internal research because the answer usually does not live in one place.",
          "From there, the same grounded workflow can move outward through shared conversations, API-driven flows, or embeddable widgets. That makes the workspace more than a research tool. It becomes an operational layer.",
        ],
      },
      {
        heading: "Treat the workspace like living product knowledge",
        paragraphs: [
          "The best teams do not think of PDF uploads and crawled websites as one-time imports. They treat them as active source layers that can be revisited, extended, and reused. That mindset is what turns a document assistant into a dependable knowledge system.",
        ],
      },
    ],
  },
  {
    slug: "when-voice-beats-typing-for-document-review",
    category: "Product",
    title: "When voice beats typing for document review",
    description:
      "Voice is not a gimmick when the document is dense, the thread is exploratory, or the reviewer needs speed over formality.",
    publishedAt: "2026-03-16",
    readTime: "5 min read",
    author: "PDF Gyan Team",
    intro:
      "Typing is still the default for most document tools, but it is not always the fastest path to understanding. When someone is reviewing a contract, scanning a research packet, or working through a long support archive, speaking the next question can be faster than composing it. Voice matters most when the conversation is exploratory and the source is already grounded.",
    keyTakeaways: [
      "Voice works best for iterative review, not polished final output.",
      "The transcript still matters because teams need an audit trail.",
      "Short turns and grounded answers make voice useful instead of noisy.",
      "Voice should be a mode inside the same workflow, not a separate product.",
    ],
    sections: [
      {
        heading: "Voice helps when the user is still figuring out the question",
        paragraphs: [
          "A lot of document work starts messy. The reviewer does not have the perfect prompt. They are trying to locate a pattern, test a suspicion, or ask a chain of narrower questions. In those moments, voice is often better than typing because it lowers the effort required to keep the loop moving.",
          "That matters in support escalations, procurement reviews, and long-form research where the first question rarely lands on the exact answer by itself.",
        ],
      },
      {
        heading: "Grounding matters even more in voice mode",
        paragraphs: [
          "Voice interfaces can feel smooth while still being unreliable. That is exactly why source grounding matters. If the answer is not anchored to the document or crawled page, speaking it aloud only makes the hallucination faster.",
          "PDF Gyan treats voice as another way into the same grounded workflow. The value is not a generic AI call. The value is asking a document-aware question without giving up the source context behind the reply.",
        ],
      },
      {
        heading: "Keep turns short and useful",
        paragraphs: [
          "Long monologues do not make good voice UX for document review. Good voice mode is built around short turns, quick clarifications, and a clean handoff between listening, thinking, and answering. That lets the user keep their momentum without losing the thread.",
          "The same principle applies to the answer. Brevity helps the user decide what to ask next.",
        ],
      },
      {
        heading: "The transcript is part of the product",
        paragraphs: [
          "Even when the interaction is spoken, teams still need a readable trail. Someone else may need to pick up the thread, share it, or turn it into a product or operational decision. That means the transcript and session history are part of the real value, not just background metadata.",
          "Voice should accelerate the review, but text should preserve it.",
        ],
      },
      {
        heading: "Use voice when speed beats polish",
        paragraphs: [
          "The best moment for voice is when the next question is obvious in your head but annoying to type. That is when a grounded call flow becomes practical. It helps the user stay inside the document instead of falling out of the workflow because the interface asked too much effort from them.",
        ],
      },
    ],
  },
  {
    slug: "how-to-chat-with-pdfs-without-losing-context",
    category: "Guides",
    title: "How to chat with PDFs without losing context",
    description:
      "A practical guide to building PDF chat that keeps page structure, follow-up context, and user trust intact.",
    publishedAt: "2026-03-12",
    readTime: "6 min read",
    author: "PDF Gyan Team",
    intro:
      "The hard part of PDF chat is not opening a document and sending a prompt. The hard part is preserving enough structure that the answer still feels tied to the source after the second, third, and fourth follow-up question. If that connection disappears, the tool becomes a summary generator instead of a working system.",
    keyTakeaways: [
      "PDF chat breaks when structure is flattened too early.",
      "Readiness state and source visibility help users trust the workflow.",
      "Follow-up questions should inherit context instead of restarting from zero.",
      "The best PDF chat systems are designed for real work, not one-off demos.",
    ],
    sections: [
      {
        heading: "Most PDF chat demos flatten the source too early",
        paragraphs: [
          "A naive workflow extracts text from a PDF, chunks it quickly, and sends everything into retrieval without caring much about page boundaries or source structure. That can produce a decent first answer, but it usually breaks down when the user asks for comparison, nuance, or evidence.",
          "Dense documents carry meaning in headings, page groupings, section order, and the ability to return to the original source. If the indexing step discards that too early, the later answer sounds confident but feels detached.",
        ],
      },
      {
        heading: "Make the document state obvious",
        paragraphs: [
          "Trust starts before the first answer. Users should know whether a PDF is still processing or ready for grounded chat. That sounds simple, but readiness state reduces confusion and keeps teams from asking questions against half-built indexes.",
          "PDF Gyan uses a workspace flow where uploads move from processing to ready, which gives the user a cleaner mental model of what the system can answer right now.",
        ],
      },
      {
        heading: "Preserve the thread, not just the first answer",
        paragraphs: [
          "Real document work is iterative. One question leads to another. Users ask for the key point, then the exception, then a comparison, then the implication. If each turn behaves like a fresh session, the conversation becomes expensive and tiring.",
          "A strong PDF workflow keeps the thread alive so the system can respond like it remembers what the user is working toward. That matters as much as the retrieval itself.",
        ],
      },
      {
        heading: "Design for handoff and review",
        paragraphs: [
          "The end state is rarely just one person reading one answer. Someone wants to share the conversation, pass it to a teammate, or embed the same workflow inside another product surface. That means the chat layer has to be usable beyond the original session.",
          "When document chat is part of a workspace instead of a one-off box, it becomes easier to reuse and easier to trust.",
        ],
      },
      {
        heading: "Keep the answer anchored to the source",
        paragraphs: [
          "The most useful PDF chat experience is calm and inspectable. It helps the user move faster without hiding the document behind model polish. When the system preserves structure, maintains thread context, and keeps the source relationship visible, the result feels less like a guess and more like assisted reading at scale.",
        ],
      },
    ],
  },
];

export const featuredBlogPosts = blogPosts.slice(0, 3);

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
