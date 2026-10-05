import { describe, expect, it } from "vitest";
import { chunkPages, describePages, parsePageRangeGroups } from "@/lib/pdf/ranges";

describe("parsePageRangeGroups", () => {
  it("keeps each comma part as its own group", () => {
    expect(parsePageRangeGroups("1-3, 5, 8-", 10).groups).toEqual([[1, 2, 3], [5], [8, 9, 10]]);
  });
  it("skips empty parts and reports problems", () => {
    expect(parsePageRangeGroups("2,,4", 5).groups).toEqual([[2], [4]]);
    expect(parsePageRangeGroups("", 5).error).toMatch(/Enter the pages/);
    expect(parsePageRangeGroups(",", 5).error).toBeDefined();
    expect(parsePageRangeGroups("1, 9", 5).error).toMatch(/doesn't exist/);
  });
});

describe("chunkPages", () => {
  it("splits into equal chunks with a shorter last one", () => {
    expect(chunkPages(10, 4)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]]);
    expect(chunkPages(3, 10)).toEqual([[1, 2, 3]]);
    expect(chunkPages(3, 1)).toEqual([[1], [2], [3]]);
    expect(chunkPages(0, 2)).toEqual([]);
  });
  it("never loops forever on a bad size", () => {
    expect(chunkPages(3, 0)).toEqual([[1], [2], [3]]);
    expect(chunkPages(3, -5)).toEqual([[1], [2], [3]]);
  });
});

describe("describePages", () => {
  it("compresses runs for file names", () => {
    expect(describePages([1, 2, 3, 5, 8, 9, 10])).toBe("1-3_5_8-10");
    expect(describePages([4])).toBe("4");
    expect(describePages([])).toBe("");
  });
});

import { addRotation, normalizeAngle } from "@/lib/pdf/rotation";

describe("rotation", () => {
  it("normalizes negative, large and off-grid angles", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-360)).toBe(0);
    expect(normalizeAngle(88)).toBe(90);
  });
  it("adds a user rotation to a page's existing one", () => {
    expect(addRotation(270, 90)).toBe(0);
    expect(addRotation(-90, -90)).toBe(180);
    expect(addRotation(0, 0)).toBe(0);
  });
});

import { pageAllowed, parsePageIntervals } from "@/lib/pdf/ranges";

describe("page intervals", () => {
  it("parses without a page count and treats open ends as unlimited", () => {
    expect(parsePageIntervals("1-3, 5, 8-").intervals).toEqual([[1, 3], [5, 5], [8, Infinity]]);
    expect(parsePageIntervals("-2").intervals).toEqual([[1, 2]]);
    expect(parsePageIntervals("  ").intervals).toEqual([]);
  });
  it("reports errors", () => {
    expect(parsePageIntervals("x").error).toBeDefined();
    expect(parsePageIntervals("4-2").error).toMatch(/backwards/);
    expect(parsePageIntervals("0").error).toMatch(/start at 1/);
  });
  it("checks membership, and allows everything when unrestricted", () => {
    const { intervals } = parsePageIntervals("2-3, 9-");
    expect([1, 2, 3, 4, 9, 500].map((p) => pageAllowed(p, intervals))).toEqual([false, true, true, false, true, true]);
    expect(pageAllowed(7, [])).toBe(true);
  });
});
