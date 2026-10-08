"use client";

import * as React from "react";
import { ArrowRight, Check, Search, Sparkles, X } from "lucide-react";
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
  featured?: boolean;
  /** Sub-section of the category this tool belongs to (for pages that group their tools). */
  group?: string;
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
  /** Localized headings for `group` values, shown when the tools are grouped. */
  groupLabels?: Record<string, string>;
}

function matchesQuery(tool: ToolGridEntry, query: string) {
  const haystack = [tool.name, tool.shortName, tool.subheading, ...tool.keywords]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function ToolGrid({ tools, searchPlaceholder, groupLabels }: ToolGridProps) {
  const t = useTranslations("common");
  const [query, setQuery] = React.useState("");
  const recentTools = useRecentToolsStore((s) => s.recentTools);
  const hasMounted = useHasMounted();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) => matchesQuery(tool, q));
  }, [tools, query]);

  const sections = React.useMemo(() => {
    if (!groupLabels) return [{ key: "all", label: null as string | null, items: filtered }];
    const order = Object.keys(groupLabels);
    return order
      .map((key) => ({ key, label: groupLabels[key] as string | null, items: filtered.filter((t) => t.group === key) }))
      .concat([{ key: "other", label: null, items: filtered.filter((t) => !t.group || !(t.group in groupLabels)) }])
      .filter((sec) => sec.items.length > 0);
  }, [filtered, groupLabels]);

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
        <div className="mt-6 space-y-10">
          {sections.map((sec) => (
            <section key={sec.key}>
              {sec.label && <h2 className="mb-4 flex items-center gap-3 text-lg font-bold tracking-tight">{sec.label}<span className="h-px flex-1 bg-border" aria-hidden /><span className="text-xs font-medium text-muted-foreground">{sec.items.length}</span></h2>}
              <div className="grid gap-4 sm:grid-cols-2">
          {sec.items.map((tool) => {
            const Icon = getToolBySlug(tool.slug)?.icon;
            const isUsed = recentSlugs.has(tool.slug);
            if (tool.featured) {
              return (
                <Link key={tool.slug} href={`/tools/${tool.category}/${tool.slug}`} className="sm:col-span-2">
                  <div className="group relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-primary/20 transition-transform duration-300 hover:-translate-y-0.5 sm:p-8">
                    <span className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
                    <span className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-fuchsia-300/20 blur-3xl" aria-hidden />
                    <div className="relative flex items-center gap-5">
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur sm:h-20 sm:w-20">
                        {Icon && <Icon className="h-8 w-8 sm:h-10 sm:w-10" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-violet-700">
                            <Sparkles className="h-3 w-3" /> {t("featured")}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
                          </span>
                        </div>
                        <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">{tool.shortName}</h2>
                        <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-white/80 sm:text-base">{tool.subheading}</p>
                      </div>
                      <ArrowRight className="hidden h-6 w-6 shrink-0 transition-transform rtl:-scale-x-100 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 sm:block" />
                    </div>
                  </div>
                </Link>
              );
            }
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
