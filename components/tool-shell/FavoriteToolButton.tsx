"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { useHasMounted } from "@/hooks/useHasMounted";
import { useFavoriteToolsStore } from "@/lib/stores/useFavoriteToolsStore";
import { cn } from "@/lib/utils";

/** A star that adds this tool to the visitor's favourites (shown on the home page). */
export function FavoriteToolButton({ slug }: { slug: string }) {
  const t = useTranslations("favorites");
  const mounted = useHasMounted();
  const slugs = useFavoriteToolsStore((s) => s.slugs);
  const toggle = useFavoriteToolsStore((s) => s.toggle);
  const on = mounted && slugs.includes(slug);
  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={on}
      aria-label={on ? t("remove") : t("add")}
      title={on ? t("remove") : t("add")}
      className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors", on ? "border-amber-400 bg-amber-400/10 text-amber-500" : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-500")}
    >
      <Star className={cn("h-4 w-4", on && "fill-current")} />
    </button>
  );
}
