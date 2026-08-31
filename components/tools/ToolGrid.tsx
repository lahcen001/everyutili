"use client";

import * as React from "react";
import { ArrowRight, Check, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { getToolBySlug } from "@/config/tools";
import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui/card";
import { useRecentToolsStore } from "@/lib/stores/useRecentToolsStore";
import { useHasMounted } from "@/hooks/useHasMounted";

export interface ToolGridEntry {
  slug: string;
  category: string;
  name: string;
  shortName: string;
  subheading: string;
  keywords: string[];
}

interface ToolGridProps {
  /**
   * Serializable, localized tool entries — built server-side (category
   * page) from config/tools.ts (slug, category, name/shortName) plus
   * messages/<locale>.json (localized subheading/keywords, used for
   * search). Icon components are NOT included here: LucideIcon values are
   * function references and cannot cross the server -> client boundary as
   * props, so each icon is instead resolved client-side below via
   * getToolBySlug(tool.slug).icon, the same shared registry config/tools.ts
   * already exports.
   */
  tools: ToolGridEntry[];
  searchPlaceholder?: string;
}

function matchesQuery(tool: ToolGridEntry, query: string) {
  const haystack = [tool.name, tool.shortName, tool.subheading, ...tool.keywords]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function ToolGrid({ tools, searchPlaceholder }: ToolGridProps) {
  const t = useTranslations("common");
  const [query, setQuery] = React.useState("");
  const recentTools = useRecentToolsStore((s) => s.recentTools);
  const hasMounted = useHasMounted();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) => matchesQuery(tool, q));
  }, [tools, query]);

  // Gated on hasMounted so the server-rendered markup (no localStorage
  // access) matches the client's first paint — recentTools only reflects
  // real persisted state one tick after hydration, same pattern as
  // RecentToolsShelf/useHasMounted elsewhere in this codebase.
  const recentSlugs = React.useMemo(
    () => (hasMounted ? new Set(recentTools.map((r) => r.slug)) : new Set<string>()),
    [hasMounted, recentTools]
  );

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder ?? t("searchPlaceholder")}
          aria-label={t("searchAriaLabel")}
          className="w-full rounded-lg border border-border bg-background py-2.5 ps-10 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label={t("clearSearchAriaLabel")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("noToolsMatch", { query })}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((tool) => {
            const Icon = getToolBySlug(tool.slug)?.icon;
            const isUsed = recentSlugs.has(tool.slug);
            return (
              <Link key={tool.slug} href={`/tools/${tool.category}/${tool.slug}`}>
                <Card
                  className={`group relative flex items-center gap-4 p-5 transition-colors hover:border-primary ${
                    isUsed ? "border-primary/60 bg-primary/[0.03]" : ""
                  }`}
                >
                  {isUsed && (
                    <span className="absolute -top-2 end-4 flex items-center gap-1 rounded-full border border-primary/30 bg-background px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Check className="h-2.5 w-2.5" />
                      {t("usedRecently")}
                    </span>
                  )}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {Icon && <Icon className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{tool.shortName}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {tool.subheading}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform rtl:-scale-x-100 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 group-hover:text-primary" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
