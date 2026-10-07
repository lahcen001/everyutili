"use client";

import * as React from "react";

/**
 * useState that survives reloads via localStorage. These tools only render on the client (ssr: false),
 * so the saved value can be read in the initial state without a hydration mismatch.
 */
export function usePersisted<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = React.useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? ({ ...(typeof initial === "object" && !Array.isArray(initial) ? initial : {}), ...JSON.parse(raw) } as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage full or blocked: keep working in memory */
        }
        return resolved;
      });
    },
    [key]
  );
  return [value, set];
}
