"use client";

import { useEffect } from "react";

import { getToolBySlug } from "@/config/tools";
import { useRecentToolsStore } from "@/lib/stores/useRecentToolsStore";

/**
 * Registers a tool page visit into the homepage "Recent Tools" shelf.
 * Called once on mount from inside each client tool component (the same
 * place that previously called `addRecentTool` directly on the shared app
 * store) — resolves name/category/path from the central registry by slug,
 * so call sites no longer hand-type duplicated metadata that can drift.
 */
export function useTrackTool(slug: string): void {
  const addToolVisit = useRecentToolsStore((s) => s.addToolVisit);

  useEffect(() => {
    const tool = getToolBySlug(slug);
    if (!tool) return;

    addToolVisit({
      slug: tool.slug,
      name: tool.shortName,
      category: tool.category,
      path: `/tools/${tool.category}/${tool.slug}`,
      icon: tool.slug,
    });
  }, [slug, addToolVisit]);
}
