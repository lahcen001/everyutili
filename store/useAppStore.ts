import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface RecentTool {
  slug: string;
  category: string;
  name: string;
  visitedAt: number;
}

export interface ImageConverterPreset {
  quality: number;
  format: "png" | "jpeg" | "webp";
  maxWidth: number | null;
}

interface AppState {
  theme: Theme;
  setTheme: (theme: Theme) => void;

  recentTools: RecentTool[];
  addRecentTool: (tool: Omit<RecentTool, "visitedAt">) => void;
  clearRecentTools: () => void;

  imageConverterPreset: ImageConverterPreset;
  setImageConverterPreset: (preset: Partial<ImageConverterPreset>) => void;
}

const MAX_RECENT_TOOLS = 8;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),

      recentTools: [],
      addRecentTool: (tool) =>
        set((state) => {
          const filtered = state.recentTools.filter((t) => t.slug !== tool.slug);
          const next: RecentTool[] = [{ ...tool, visitedAt: Date.now() }, ...filtered].slice(
            0,
            MAX_RECENT_TOOLS
          );
          return { recentTools: next };
        }),
      clearRecentTools: () => set({ recentTools: [] }),

      imageConverterPreset: { quality: 0.92, format: "png", maxWidth: null },
      setImageConverterPreset: (preset) =>
        set((state) => ({
          imageConverterPreset: { ...state.imageConverterPreset, ...preset },
        })),
    }),
    {
      name: "omnitools-store",
      partialize: (state) => ({
        theme: state.theme,
        recentTools: state.recentTools,
        imageConverterPreset: state.imageConverterPreset,
      }),
    }
  )
);
