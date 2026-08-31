"use client";

import * as React from "react";

import { useRecentToolsStore } from "@/lib/stores/useRecentToolsStore";
import { useHasMounted } from "@/hooks/useHasMounted";
import { BentoToolGrid, type BentoTool } from "@/components/home/BentoToolGrid";

const FALLBACK_COUNT = 4;

interface CategoryToolSectionProps {
  category: string;
  /** Every tool in this category, localized, sorted most-used-first by editorial priority. */
  tools: BentoTool[];
}

/**
 * Picks which tools to show for one homepage category section: the user's
 * own recently-used tools in that category if they have any, otherwise the
 * top editorial-priority tools (this file's `tools` prop is already sorted
 * that way, so the fallback is just its first N entries). Reads
 * localStorage via useRecentToolsStore, so — like RecentToolsShelf — this
 * renders the fallback (not empty) on the server/first paint and only
 * swaps to the user's real recent tools one tick after hydration, avoiding
 * a hydration mismatch while still never showing a blank section.
 */
export function CategoryToolSection({ category, tools }: CategoryToolSectionProps) {
  const recentTools = useRecentToolsStore((s) => s.recentTools);
  const hasMounted = useHasMounted();

  const toolsBySlug = React.useMemo(() => {
    const map = new Map<string, BentoTool>();
    tools.forEach((tool) => map.set(tool.slug, tool));
    return map;
  }, [tools]);

  const displayedTools = React.useMemo(() => {
    if (hasMounted) {
      const recentInCategory = recentTools
        .filter((r) => r.category === category)
        .map((r) => toolsBySlug.get(r.slug))
        .filter((t): t is BentoTool => Boolean(t));
      if (recentInCategory.length > 0) return recentInCategory;
    }
    return tools.slice(0, FALLBACK_COUNT);
  }, [hasMounted, recentTools, category, toolsBySlug, tools]);

  const featuredTools = React.useMemo(
    () => displayedTools.map((tool, index) => ({ ...tool, featured: index === 0 })),
    [displayedTools]
  );

  return <BentoToolGrid tools={featuredTools} />;
}
