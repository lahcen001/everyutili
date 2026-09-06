"use client";

import * as React from "react";
import { Menu, Puzzle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/config/tools";

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/plidfaahplllkmlhnnnbmkokkocfcgpc";

/**
 * Category navigation for narrower viewports, where the full-width inline
 * nav (SiteHeader's `xl:flex` list) is hidden to avoid crowding the search
 * bar and language switcher. Same dropdown pattern as LanguageSwitcher.
 */
export function MobileNav() {
  const t = useTranslations("categories");
  const tNav = useTranslations("nav");
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
    <div ref={containerRef} className="relative xl:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={tNav("categoriesMenu")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label={tNav("categoriesMenu")}
          className="absolute start-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/tools/${category}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              {t(`${category}.label`)}
            </Link>
          ))}
          <div className="my-1 border-t border-border" />
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            <Puzzle className="h-4 w-4" />
            Add to Chrome
          </a>
        </div>
      )}
    </div>
  );
}
