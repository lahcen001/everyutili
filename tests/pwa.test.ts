import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

const root = process.cwd();

describe("installable app", () => {
  const m = manifest();
  it("has a complete web app manifest", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toMatch(/^\//);
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });
  it("ships every icon and the offline page it refers to", () => {
    for (const icon of m.icons ?? []) expect(existsSync(path.join(root, "public", icon.src)), icon.src).toBe(true);
    expect(existsSync(path.join(root, "public/offline.html"))).toBe(true);
    expect(existsSync(path.join(root, "public/icons/apple-touch-icon.png"))).toBe(true);
  });
  it("has a service worker that caches the offline page and cleans old caches", () => {
    const sw = readFileSync(path.join(root, "public/sw.js"), "utf-8");
    expect(sw).toContain("/offline.html");
    expect(sw).toContain("caches.delete");
    expect(sw).toContain('req.method !== "GET"');
  });
});
