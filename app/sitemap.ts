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

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Homepage: one entry per locale (12), each with the full hreflang cluster.
  const homeRoutes: MetadataRoute.Sitemap = routing.locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified,
    changeFrequency: "daily",
    priority: 1,
    alternates: { languages: languageAlternates((l) => `/${l}`) },
  }));

  // Category listing pages: 4 categories x 12 locales = 48 entries.
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

  // Tool pages: 36 tools x 12 locales = 432 entries.
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

  return [...homeRoutes, ...categoryRoutes, ...toolRoutes];
}
