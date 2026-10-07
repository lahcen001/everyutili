"use client";

import * as React from "react";

export interface BatchProcessable {
  id: string;
  status: "pending" | "processing" | "done" | "error";
  /** The settings key this item was last processed with. */
  doneKey?: string;
}

interface Options<T extends BatchProcessable> {
  queue: T[];
  setQueue: React.Dispatch<React.SetStateAction<T[]>>;
  /** Changes whenever any setting that affects the output changes. */
  settingsKey: string;
  /** Processes one item with the current settings and returns the fields to merge into it. Throw to mark it failed. */
  process: (item: T) => Promise<Partial<T>>;
  delay?: number;
}

/**
 * Live batch processing: every item whose result is missing or was made with
 * different settings is (re)processed one by one shortly after the queue or a
 * setting changes. A change mid-run stops the run after the current item and
 * starts over with the new settings.
 */
export function useBatchProcessor<T extends BatchProcessable>({ queue, setQueue, settingsKey, process, delay = 350 }: Options<T>) {
  const [running, setRunning] = React.useState(false);
  const runKey = React.useRef(settingsKey);
  const cancel = React.useRef(0);

  React.useEffect(() => {
    if (running) {
      if (runKey.current !== settingsKey) cancel.current += 1;
      return;
    }
    const todo = queue.filter((q) => q.status !== "processing" && q.doneKey !== settingsKey);
    if (todo.length === 0) return;

    const timer = window.setTimeout(async () => {
      const mine = ++cancel.current;
      runKey.current = settingsKey;
      setRunning(true);
      for (const item of todo) {
        if (cancel.current !== mine) break;
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q)));
        let patch: Partial<T>;
        try {
          patch = { ...(await process(item)), status: "done", doneKey: settingsKey } as Partial<T>;
        } catch (e) {
          patch = { status: "error", error: e instanceof Error ? e.message : "Failed", doneKey: settingsKey } as unknown as Partial<T>;
        }
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, ...patch } : q)));
      }
      setRunning(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [queue, settingsKey, running, process, setQueue, delay]);

  return { running };
}
