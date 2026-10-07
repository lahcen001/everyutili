"use client";

import { useEffect } from "react";
import { purgeExpiredHistory } from "@/lib/storage/toolHistoryDb";

const LAST_RUN_KEY = "everyutili-history-cleanup";
const ONE_DAY = 24 * 60 * 60 * 1000;

/** Silently removes saved results older than one month, at most once a day. */
export function HistoryCleanup() {
  useEffect(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_RUN_KEY)) || 0;
    } catch {
      /* storage unavailable */
    }
    if (Date.now() - last < ONE_DAY) return;
    const run = () => {
      purgeExpiredHistory()
        .then(() => {
          try {
            localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
          } catch {
            /* storage unavailable */
          }
        })
        .catch(() => {});
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(run);
    else setTimeout(run, 3000);
  }, []);
  return null;
}
