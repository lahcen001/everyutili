"use client";

import * as React from "react";

/**
 * Shrinks an element's font until its text fits on one line, so long numbers never overflow or push the layout.
 * The element must be `overflow-hidden whitespace-nowrap` (or an input). Re-fits when `trigger` or the width changes.
 */
export function useFitFont<T extends HTMLElement>(ref: React.RefObject<T | null>, trigger: unknown, max: number, min = 14) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = max;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth + 1 && size > min) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, trigger, max, min]);
}
