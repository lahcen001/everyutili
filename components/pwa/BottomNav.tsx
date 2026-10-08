"use client";

import { Heart, Home, Search, Settings2, Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/routing";
import { useAppMode } from "@/components/pwa/useAppMode";
import { cn } from "@/lib/utils";

const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not supported */
  }
};

const openSearch = () => {
  buzz();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
};

/** App-style tab bar. Only shown when the site is installed and opened like an app, on a phone-size screen. */
export function BottomNav() {
  const t = useTranslations("app");
  const { standalone } = useAppMode();
  const pathname = usePathname();
  if (!standalone) return null;

  const links = [
    { href: "/", label: t("navHome"), icon: Home, active: pathname === "/" },
    { href: "/tools/focus-study", label: t("navFocus"), icon: Timer, active: pathname.startsWith("/tools/focus-study") },
  ];
  const tail = [
    { href: "/#favorites", label: t("navFavorites"), icon: Heart, active: false },
    { href: "/my-data", label: t("navSettings"), icon: Settings2, active: pathname.startsWith("/my-data") },
  ];
  const item = (l: { href: string; label: string; icon: typeof Home; active: boolean }) => (
    <Link key={l.href} href={l.href} onClick={buzz} aria-current={l.active ? "page" : undefined} className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors active:scale-95", l.active ? "text-primary" : "text-muted-foreground")}>
      <l.icon className={cn("h-5 w-5", l.active && "stroke-[2.4]")} />
      <span className="max-w-full truncate px-1">{l.label}</span>
    </Link>
  );

  return (
    <nav aria-label={t("navLabel")} className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex max-w-md items-stretch px-2 pt-1">
        {links.map(item)}
        <button type="button" onClick={openSearch} aria-label={t("navSearch")} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-muted-foreground active:scale-95">
          <span className="-mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"><Search className="h-5 w-5" /></span>
          <span className="max-w-full truncate px-1">{t("navSearch")}</span>
        </button>
        {tail.map(item)}
      </div>
    </nav>
  );
}
