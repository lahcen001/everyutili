import { describe, expect, it, vi } from "vitest";

const db = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  createStore: () => ({}),
  get: async (k: string) => db.get(k),
  set: async (k: string, v: unknown) => void db.set(k, v),
  del: async (k: string) => void db.delete(k),
  keys: async () => [...db.keys()],
}));

import { HISTORY_MAX_AGE_MS, getToolHistory, purgeExpiredHistory } from "@/lib/storage/toolHistoryDb";

describe("history expiry", () => {
  it("deletes results older than a month and keeps recent ones", async () => {
    const now = Date.now();
    db.set("a:old", { id: "old", toolSlug: "a", timestamp: now - HISTORY_MAX_AGE_MS - 1000, title: "", summary: "" });
    db.set("a:new", { id: "new", toolSlug: "a", timestamp: now - 1000, title: "", summary: "" });
    expect((await getToolHistory("a")).map((i) => i.id)).toEqual(["new"]);
    expect(await purgeExpiredHistory(now)).toBe(1);
    expect([...db.keys()]).toEqual(["a:new"]);
  });
});
