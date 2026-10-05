// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { withExplicitSize } from "@/lib/svgRaster";

describe("withExplicitSize", () => {
  it("adds a viewBox from width/height and overrides the size", () => {
    const out = withExplicitSize('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12"/></svg>', 480, 240);
    expect(out).toContain('viewBox="0 0 24 12"');
    expect(out).toContain('width="480"');
    expect(out).toContain('height="240"');
  });
  it("keeps an existing viewBox and adds the namespace", () => {
    const out = withExplicitSize('<svg viewBox="0 0 10 10"><circle r="4"/></svg>', 100, 100);
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain("http://www.w3.org/2000/svg");
  });
  it("rejects non-svg input", () => {
    expect(() => withExplicitSize("<html><body/></html>", 10, 10)).toThrow();
    expect(() => withExplicitSize("<svg><", 10, 10)).toThrow();
  });
});
