"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { getToolBySlug } from "@/config/tools";
import { useHasMounted } from "@/hooks/useHasMounted";
import { Link } from "@/i18n/routing";
import { useFavoriteToolsStore } from "@/lib/stores/useFavoriteToolsStore";

/** Home-page row of the tools the visitor starred. Hidden until they star one. */
export function FavoritesShelf() {
  const t = useTranslations("favorites");
  const mounted = useHasMounted();
  const slugs = useFavoriteToolsStore((s) => s.slugs);
  const tools = slugs.map((s) => getToolBySlug(s)).filter((x): x is NonNullable<typeof x> => !!x);
  if (!mounted || tools.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-6 pt-2" aria-label={t("heading")}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
        <Star className="h-4 w-4 fill-amber-400 text-amber-500" /> {t("heading")}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.slug} href={`/tools/${tool.category}/${tool.slug}`} className="flex w-40 shrink-0 flex-col rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50 sm:w-auto">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
              <span className="mt-2 truncate text-sm font-semibold">{tool.shortName}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
