"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname, locales, localeNames, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

/**
 * Real, crawlable links: one next-intl `<Link>` per locale with an
 * explicit `locale` prop (renders as an actual `<a href>`), not a
 * `<select>` + `router.push` pattern. `usePathname()` from `i18n/routing`
 * returns the pathname WITHOUT the locale prefix, so the same path is
 * reused for every locale link — only the locale prefix changes.
 */
export function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const activeLocale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("label")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe className="h-5 w-5" />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label={t("label")}
          className="absolute end-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {locales.map((loc) => (
            <Link
              key={loc}
              href={pathname}
              locale={loc}
              role="menuitem"
              onClick={() => setOpen(false)}
              aria-current={loc === activeLocale ? "true" : undefined}
              className={`block rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                loc === activeLocale ? "font-semibold text-primary" : "text-foreground"
              }`}
            >
              {localeNames[loc as Locale]}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
