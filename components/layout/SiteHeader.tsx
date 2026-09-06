import { Puzzle, Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { MobileNav } from "@/components/layout/MobileNav";
import { LanguageSwitcher } from "@/components/navigation/LanguageSwitcher";
import { CommandMenu } from "@/components/search/CommandMenu";
import { CATEGORIES } from "@/config/tools";

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/plidfaahplllkmlhnnnbmkokkocfcgpc";

export async function SiteHeader() {
  const t = await getTranslations("categories");

  return (
    <header className="site-header sticky top-0 z-40 w-full">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex shrink-0 items-center gap-1">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wrench className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">EveryUtili</span>
          </Link>
        </div>
        <nav className="hidden shrink-0 items-center gap-4 text-sm font-medium text-muted-foreground xl:flex">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/tools/${category}`}
              className="whitespace-nowrap transition-colors hover:text-foreground"
            >
              {t(`${category}.navLabel`)}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <CommandMenu />
          </div>
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 sm:inline-flex"
          >
            <Puzzle className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Add to Chrome</span>
          </a>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
