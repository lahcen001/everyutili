import { routing, defaultLocale } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

/**
 * Builds the `alternates.languages` dictionary for `generateMetadata`,
 * covering every supported locale plus `x-default` (pointed at the
 * default locale's URL), each mapped to the absolute, locale-prefixed URL
 * for the given path. `zh-CN`'s hyphen is preserved verbatim — it's a
 * valid BCP-47 / hreflang tag and must not be split or altered.
 *
 * @param pathForLocale given a locale, returns the path (no leading
 *   origin, starting with `/`) for that locale, e.g.
 *   `(locale) => \`/${locale}/tools/media/jpg-to-png\``
 */
export function buildLanguageAlternates(
  pathForLocale: (locale: string) => string
): Record<string, string> {
  const languages: Record<string, string> = {};

  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}${pathForLocale(locale)}`;
  }

  languages["x-default"] = `${SITE_URL}${pathForLocale(defaultLocale)}`;

  return languages;
}
