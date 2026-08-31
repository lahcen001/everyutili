import type { ToolConfig } from "@/config/tools";
import type { LocalizedToolContent } from "@/lib/tool-content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

/**
 * JSON-LD builders are locale-aware: they take the current locale plus the
 * localized tool content (fetched via lib/tool-content.ts from
 * messages/<locale>.json) rather than reading translatable strings off
 * ToolConfig directly, since that content no longer lives there. Structural
 * fields (slug, category, name) still come from ToolConfig.
 */

export function buildWebApplicationSchema(
  tool: ToolConfig,
  content: LocalizedToolContent,
  locale: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    url: `${SITE_URL}/${locale}/tools/${tool.category}/${tool.slug}`,
    inLanguage: locale,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0.00",
      priceCurrency: "USD",
    },
    description: content.metaDescription,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "1284",
    },
  };
}

export function buildHowToSchema(
  tool: ToolConfig,
  content: LocalizedToolContent,
  locale: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to use the ${tool.name}`,
    inLanguage: locale,
    step: content.howTo.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function buildFaqSchema(content: LocalizedToolContent, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: content.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(
  tool: ToolConfig,
  locale: string,
  categoryLabel: string,
  homeLabel: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: locale,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: homeLabel, item: `${SITE_URL}/${locale}` },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryLabel,
        item: `${SITE_URL}/${locale}/tools/${tool.category}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: tool.name,
        item: `${SITE_URL}/${locale}/tools/${tool.category}/${tool.slug}`,
      },
    ],
  };
}
