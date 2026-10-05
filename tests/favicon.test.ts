import { describe, expect, it } from "vitest";
import { buildHtmlSnippet, buildIco, buildManifest, placeSource } from "@/lib/favicon";

describe("favicon", () => {
  it("builds a valid ICO directory", () => {
    const a = Uint8Array.from([1, 2, 3]);
    const b = Uint8Array.from([4, 5, 6, 7]);
    const ico = buildIco([{ size: 16, png: a }, { size: 256, png: b }]);
    const v = new DataView(ico.buffer);
    expect(v.getUint16(2, true)).toBe(1);
    expect(v.getUint16(4, true)).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[6 + 16]).toBe(0); // 256 is stored as 0
    expect(v.getUint32(6 + 8, true)).toBe(3);
    const off0 = v.getUint32(6 + 12, true);
    const off1 = v.getUint32(6 + 16 + 12, true);
    expect(off0).toBe(6 + 32);
    expect(Array.from(ico.slice(off0, off0 + 3))).toEqual([1, 2, 3]);
    expect(Array.from(ico.slice(off1, off1 + 4))).toEqual([4, 5, 6, 7]);
    expect(ico.length).toBe(off1 + 4);
  });
  it("builds manifest and snippet", () => {
    const m = JSON.parse(buildManifest({ name: "My App", shortName: "", themeColor: "#123456", backgroundColor: "#ffffff" }));
    expect(m.short_name).toBe("My App");
    expect(m.icons).toHaveLength(2);
    expect(buildHtmlSnippet("#123456")).toContain('content="#123456"');
  });
  it("places a wide image: cover crops, contain letterboxes", () => {
    const cover = placeSource(200, 100, 64, "cover", 0);
    expect(cover).toMatchObject({ sx: 50, sy: 0, sw: 100, sh: 100, dw: 64 });
    const contain = placeSource(200, 100, 64, "contain", 0);
    expect(contain.dw).toBe(64);
    expect(contain.dh).toBe(32);
    expect(contain.dy).toBe(16);
    const padded = placeSource(100, 100, 100, "contain", 10);
    expect(padded.dx).toBe(10);
    expect(padded.dw).toBe(80);
  });
});
