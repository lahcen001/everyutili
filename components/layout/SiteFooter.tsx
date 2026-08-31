import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { CATEGORIES, TOOLS } from "@/config/tools";

/** Keep the footer compact: a handful of the most-used tools per category, not all of them. */
const MAX_TOOLS_PER_COLUMN = 5;

export async function SiteFooter() {
  const t = await getTranslations("categories");
  const tNav = await getTranslations("nav");
  const tSite = await getTranslations("site");

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 md:grid-cols-4">
        {CATEGORIES.map((category) => {
          const topTools = TOOLS.filter((tool) => tool.category === category)
            .slice()
            .sort((a, b) => b.priority - a.priority)
            .slice(0, MAX_TOOLS_PER_COLUMN);

          return (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold">{t(`${category}.label`)}</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {topTools.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/tools/${tool.category}/${tool.slug}`}
                      className="transition-colors hover:text-foreground"
                    >
                      {tool.shortName}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href={`/tools/${category}`}
                    className="font-medium text-primary transition-colors hover:underline"
                  >
                    {tNav("viewAll")}
                  </Link>
                </li>
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} {tSite("footerCopyright")}
        </p>
        <p className="mt-1 flex items-center justify-center gap-3">
          <Link href="/extension" className="font-medium text-primary hover:underline">
            Get the Chrome extension
          </Link>
          <span aria-hidden="true">&middot;</span>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </footer>
  );
}
