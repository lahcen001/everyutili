import { describe, expect, it } from "vitest";
import { paginate } from "@/lib/office/paginate";

describe("paginate", () => {
  it("returns a single page when everything fits", () => {
    expect(paginate(500, 1000, [100, 300])).toEqual([{ start: 0, end: 500 }]);
  });

  it("breaks at the last allowed point that fits, never mid-block", () => {
    // blocks end at 400, 900, 1300, 1700; page height 1000
    const pages = paginate(1700, 1000, [400, 900, 1300, 1700]);
    expect(pages).toEqual([
      { start: 0, end: 900 },
      { start: 900, end: 1700 },
    ]);
  });

  it("cuts at the page boundary only when one block is taller than a page", () => {
    const pages = paginate(2500, 1000, [2500]);
    expect(pages).toEqual([
      { start: 0, end: 1000 },
      { start: 1000, end: 2000 },
      { start: 2000, end: 2500 },
    ]);
  });

  it("covers the whole document with contiguous, non-empty slices", () => {
    const breaks = [120, 480, 777, 1500, 2100, 2650];
    const pages = paginate(3000, 900, breaks);
    expect(pages[0].start).toBe(0);
    expect(pages[pages.length - 1].end).toBe(3000);
    pages.forEach((p, i) => {
      expect(p.end).toBeGreaterThan(p.start);
      expect(p.end - p.start).toBeLessThanOrEqual(900);
      if (i > 0) expect(p.start).toBe(pages[i - 1].end);
    });
  });

  it("handles degenerate input", () => {
    expect(paginate(0, 1000, [])).toEqual([{ start: 0, end: 0 }]);
    expect(paginate(100, 0, [])).toEqual([{ start: 0, end: 100 }]);
  });
});
