import type { Metadata } from "next";

import type { ToolConfig } from "@/config/tools";
import type { LocalizedToolContent } from "@/lib/tool-content";
import { buildLanguageAlternates } from "@/lib/alternates";
import {
  buildWebApplicationSchema,
  buildHowToSchema,
  buildFaqSchema,
  buildBreadcrumbSchema,
} from "@/lib/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

/**
 * The unified multi-type JSON-LD stack for one tool page: WebApplication,
 * HowTo, FAQPage, and BreadcrumbList, in the order search engines and LLM
 * crawlers most reliably parse (entity definition first, then process,
 * then Q&A, then site hierarchy).
 */
export function generateToolJsonLd(
  tool: ToolConfig,
  content: LocalizedToolContent,
  locale: string,
  categoryLabel: string,
  homeLabel: string
) {
  return [
    buildWebApplicationSchema(tool, content, locale),
    buildHowToSchema(tool, content, locale),
    buildFaqSchema(content, locale),
    buildBreadcrumbSchema(tool, locale, categoryLabel, homeLabel),
  ];
}

/**
 * Full Next.js Metadata for a tool page: title, description, keywords,
 * self-referencing canonical, the complete hreflang cluster (12 locales +
 * x-default), and OpenGraph/Twitter cards.
 */
export function generateToolMetadata(
  tool: ToolConfig,
  content: LocalizedToolContent,
  locale: string
): Metadata {
  const url = `${SITE_URL}/${locale}/tools/${tool.category}/${tool.slug}`;
  const pathForLocale = (l: string) => `/${l}/tools/${tool.category}/${tool.slug}`;

  return {
    title: content.seoTitle,
    description: content.metaDescription,
    keywords: content.keywords,
    alternates: {
      canonical: url,
      languages: buildLanguageAlternates(pathForLocale),
    },
    openGraph: {
      title: content.seoTitle,
      description: content.metaDescription,
      url,
      type: "website",
      siteName: "EveryUtili",
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: content.seoTitle,
      description: content.metaDescription,
    },
  };
}
