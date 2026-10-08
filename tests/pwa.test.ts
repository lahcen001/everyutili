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
  it("offers app shortcuts and receives shared files", () => {
    const full = m as unknown as { shortcuts: { url: string }[]; share_target: { action: string; method: string; params: { files: { name: string }[] } }; id: string; display_override: string[] };
    expect(full.shortcuts.length).toBeGreaterThanOrEqual(3);
    for (const s of full.shortcuts) expect(s.url).toMatch(/^\/tools\//);
    expect(full.share_target.action).toBe("/share-target");
    expect(full.share_target.method).toBe("POST");
    expect(full.share_target.params.files[0].name).toBe("media");
    expect(full.display_override).toContain("standalone");
    expect(full.id).toBeTruthy();
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
    expect(sw).toContain("SKIP_WAITING");
    expect(sw).toContain("/share-target");
    expect(sw).toContain("LIMITS");
  });
});
