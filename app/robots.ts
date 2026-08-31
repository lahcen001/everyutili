import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

// Standard web crawlers plus AI/LLM answer-engine crawlers. Explicitly
// allowlisting each by name (rather than relying on the wildcard `*` rule
// alone) keeps intent unambiguous for operators that special-case unknown
// user agents to "disallow all" by default.
const AI_CRAWLERS = [
  "GPTBot", // OpenAI / ChatGPT Search
  "OAI-SearchBot", // OpenAI search crawler
  "ChatGPT-User",
  "PerplexityBot", // Perplexity
  "Perplexity-User",
  "ClaudeBot", // Anthropic / Claude
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended", // Gemini / Google AI training & grounding
  "Applebot-Extended", // Apple Intelligence
  "Bytespider", // ByteDance / Doubao
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
      },
      {
        userAgent: "Bingbot",
        allow: "/",
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
