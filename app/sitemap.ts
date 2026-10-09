import type { MetadataRoute } from "next";

import { CATEGORIES, TOOLS } from "@/config/tools";
import { routing, defaultLocale } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

/**
 * Builds the `alternates.languages` map Next's sitemap generator turns into
 * `xhtml:link rel="alternate"` entries for one sitemap entry, covering
 * every supported locale plus `x-default` (pointed at the default
 * locale's URL).
 */
function languageAlternates(pathForLocale: (locale: string) => string) {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}${pathForLocale(locale)}`;
  }
  languages["x-default"] = `${SITE_URL}${pathForLocale(defaultLocale)}`;
  return languages;
}

/**
 * Date of the last content change. A fixed date (instead of "now") keeps the sitemap stable between
 * builds, so search engines only see a change when we bump this on a real update.
 */
const LAST_CONTENT_UPDATE = new Date("2026-10-08");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = LAST_CONTENT_UPDATE;

  // Homepage: one entry per locale (12), each with the full hreflang cluster.
  const homeRoutes: MetadataRoute.Sitemap = routing.locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified,
    changeFrequency: "daily",
    priority: 1,
    alternates: { languages: languageAlternates((l) => `/${l}`) },
  }));

  // Category listing pages: every category x every locale.
  const categoryRoutes: MetadataRoute.Sitemap = routing.locales.flatMap((locale) =>
    CATEGORIES.map((category) => ({
      url: `${SITE_URL}/${locale}/tools/${category}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: {
        languages: languageAlternates((l) => `/${l}/tools/${category}`),
      },
    }))
  );

  // Tool pages: every tool x every locale.
  const toolRoutes: MetadataRoute.Sitemap = routing.locales.flatMap((locale) =>
    TOOLS.map((tool) => ({
      url: `${SITE_URL}/${locale}/tools/${tool.category}/${tool.slug}`,
      lastModified,
      changeFrequency: tool.changeFrequency,
      priority: tool.priority,
      alternates: {
        languages: languageAlternates(
          (l) => `/${l}/tools/${tool.category}/${tool.slug}`
        ),
      },
    }))
  );

  // Static pages (privacy policy and the Chrome extension page).
  const staticRoutes: MetadataRoute.Sitemap = routing.locales.flatMap((locale) =>
    ["privacy", "extension", "games"].map((page) => ({
      url: `${SITE_URL}/${locale}/${page}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: page === "games" ? 0.7 : page === "extension" ? 0.6 : 0.3,
      alternates: { languages: languageAlternates((l) => `/${l}/${page}`) },
    }))
  );

  return [...homeRoutes, ...categoryRoutes, ...toolRoutes, ...staticRoutes];
}
