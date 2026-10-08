import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoriteToolsState {
  /** tool slugs, in the order they were starred */
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
}

/** Tools the visitor starred. Saved in localStorage under `everyutili_favorite_tools`. */
export const useFavoriteToolsStore = create<FavoriteToolsState>()(
  persist(
    (set, get) => ({
      slugs: [],
      toggle: (slug) => set((s) => ({ slugs: s.slugs.includes(slug) ? s.slugs.filter((x) => x !== slug) : [...s.slugs, slug] })),
      has: (slug) => get().slugs.includes(slug),
    }),
    { name: "everyutili_favorite_tools" }
  )
);
