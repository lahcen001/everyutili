"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * Returns false during SSR and the first client render, true afterward —
 * for gating client-only reads (localStorage, IndexedDB) without a
 * hydration mismatch. Implemented via useSyncExternalStore instead of a
 * useState+useEffect mount flag: the getServerSnapshot/getSnapshot split is
 * exactly what the API is for, and (unlike a bare `useEffect(() =>
 * setMounted(true))`) it doesn't trip the react-hooks/set-state-in-effect
 * rule, since there's no setState call in an effect body at all.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
