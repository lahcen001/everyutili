import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Serializable navigation-history entry for one tool visit. `icon` is
 * stored as the tool's slug (a string key), not a LucideIcon component
 * reference — function references cannot be persisted to localStorage or
 * safely cross the server/client boundary. Consumers resolve the actual
 * icon client-side via `getToolBySlug(slug).icon`, the same pattern already
 * used by ToolGrid/RelatedTools/BentoToolGrid.
 */
export interface RecentToolEntry {
  slug: string;
  name: string;
  category: string;
  path: string;
  icon: string;
  lastVisited: number;
}

const MAX_RECENT_TOOLS = 5;

interface RecentToolsState {
  recentTools: RecentToolEntry[];
  addToolVisit: (tool: Omit<RecentToolEntry, "lastVisited">) => void;
  removeTool: (slug: string) => void;
  clearAll: () => void;
}

/**
 * Dedicated store for the homepage "Recent Tools" shelf: strictly capped at
 * 5 entries, LRU-ordered (most recently visited first, re-visiting an
 * existing entry moves it back to the front rather than duplicating it).
 * Persisted to localStorage for instant synchronous reads on next load.
 */
export const useRecentToolsStore = create<RecentToolsState>()(
  persist(
    (set) => ({
      recentTools: [],

      addToolVisit: (tool) =>
        set((state) => {
          const filtered = state.recentTools.filter((t) => t.slug !== tool.slug);
          const next: RecentToolEntry[] = [
            { ...tool, lastVisited: Date.now() },
            ...filtered,
          ].slice(0, MAX_RECENT_TOOLS);
          return { recentTools: next };
        }),

      removeTool: (slug) =>
        set((state) => ({
          recentTools: state.recentTools.filter((t) => t.slug !== slug),
        })),

      clearAll: () => set({ recentTools: [] }),
    }),
    {
      name: "omnitools-recent-tools",
    }
  )
);
