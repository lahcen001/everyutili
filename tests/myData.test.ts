import { describe, expect, it } from "vitest";
import { buildBackup, collect, formatSize, groupOf, isAppKey, parseBackup, summarize, type StorageLike } from "@/lib/myData";

const fake = (data: Record<string, string>): StorageLike => {
  const keys = Object.keys(data);
  return { length: keys.length, key: (i) => keys[i] ?? null, getItem: (k) => data[k] ?? null };
};

describe("my data", () => {
  const store = fake({
    everyutili_todos: '[{"text":"a"}]',
    everyutili_habits: "[]",
    everyutili_flashcards: '{"decks":[]}',
    "omnitools-recent-tools": "{}",
    "onmitools:iptv-favorites": "[]",
    theme: "dark",
    unrelated: "x",
  });

  it("only touches our own keys", () => {
    expect(isAppKey("everyutili_x")).toBe(true);
    expect(isAppKey("onmitools:iptv-recent")).toBe(true);
    expect(isAppKey("theme")).toBe(false);
    expect(collect(store).map((e) => e.key)).toEqual(["everyutili_flashcards", "everyutili_habits", "everyutili_todos", "omnitools-recent-tools", "onmitools:iptv-favorites"]);
  });

  it("groups keys in plain categories", () => {
    expect(groupOf("everyutili_todos")).toBe("tasks");
    expect(groupOf("everyutili_habits")).toBe("habits");
    expect(groupOf("everyutili_flashcards")).toBe("flashcards");
    expect(groupOf("everyutili_countdowns")).toBe("exams");
    expect(groupOf("everyutili_pomodoro_prefs")).toBe("focus");
    expect(groupOf("everyutili_2048_best")).toBe("games");
    expect(groupOf("everyutili_qr_design")).toBe("qr");
    expect(groupOf("everyutili_wheel_entries")).toBe("random");
    expect(groupOf("omnitools-recent-tools")).toBe("tools");
    expect(groupOf("everyutili_mystery")).toBe("other");
    const s = summarize(collect(store));
    expect(s.reduce((n, g) => n + g.items, 0)).toBe(5);
  });

  it("round-trips a backup and rejects anything else", () => {
    const backup = buildBackup(collect(store), new Date("2026-01-01T00:00:00Z"));
    expect(backup.exportedAt).toBe("2026-01-01T00:00:00.000Z");
    const restored = parseBackup(JSON.stringify(backup));
    expect(restored).toEqual(backup.data);
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ format: "other", version: 1, data: {} }))).toBeNull();
    expect(parseBackup(JSON.stringify({ ...backup, version: 99 }))).toBeNull();
  });

  it("ignores keys that are not ours when restoring", () => {
    const text = JSON.stringify({ format: "everyutili-backup", version: 1, exportedAt: "", data: { everyutili_todos: "[]", evil: "x", "__proto__": "y" } });
    expect(parseBackup(text)).toEqual({ everyutili_todos: "[]" });
  });

  it("formats sizes", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
