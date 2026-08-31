import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { defaultLocale } from "@/i18n/routing";

/**
 * `not-found.js` files do not accept props (no `params`), so the locale
 * that triggered this — whether a bad path under a valid locale or an
 * invalid locale segment itself — isn't directly available here. We fall
 * back to the default locale's messages, which still renders real,
 * translated copy for the common case (valid locale, bad tool/category
 * slug) and a sane English fallback for a genuinely invalid locale
 * segment, where no per-locale copy could apply anyway.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations({ locale: defaultLocale, namespace: "common" });

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-3xl font-bold tracking-tight">{t("notFoundTitle")}</h1>
      <Link href="/" locale={defaultLocale} className="mt-2 text-sm font-medium text-primary hover:underline">
        {t("notFoundCta")}
      </Link>
    </div>
  );
}
