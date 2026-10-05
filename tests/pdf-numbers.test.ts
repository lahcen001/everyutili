import { describe, expect, it } from "vitest";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { formatNumeral, hexToRgb01, placeLabel, toRoman } from "@/lib/pdf/pageNumbers";

describe("parsePageRanges", () => {
  it("treats blank as all pages", () => {
    expect(parsePageRanges("", 4).pages).toEqual([1, 2, 3, 4]);
  });
  it("parses lists, ranges, open ends and duplicates", () => {
    expect(parsePageRanges("1-3, 5, 8-", 10).pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
    expect(parsePageRanges("-2,2,1", 5).pages).toEqual([1, 2]);
    expect(parsePageRanges("3-99", 5).pages).toEqual([3, 4, 5]);
  });
  it("reports clear errors", () => {
    expect(parsePageRanges("abc", 5).error).toMatch(/valid/);
    expect(parsePageRanges("5-2", 9).error).toMatch(/backwards/);
    expect(parsePageRanges("7", 5).error).toMatch(/doesn't exist/);
    expect(parsePageRanges("0", 5).error).toMatch(/start at 1/);
    expect(parsePageRanges("-", 5).error).toBeDefined();
  });
});

describe("numerals and colors", () => {
  it("converts roman numerals", () => {
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(1994)).toBe("MCMXCIV");
    expect(toRoman(0)).toBe("0");
    expect(formatNumeral(12, "roman-lower")).toBe("xii");
    expect(formatNumeral(12, "arabic")).toBe("12");
  });
  it("parses hex colors with a safe fallback", () => {
    expect(hexToRgb01("#ff0000")).toEqual([1, 0, 0]);
    expect(hexToRgb01("0f0")).toEqual([0, 1, 0]);
    expect(hexToRgb01("nope")).toEqual([0, 0, 0]);
  });
});

describe("placeLabel", () => {
  const base = { width: 600, height: 800, textWidth: 20, margin: 24 };
  it("places bottom-center on an unrotated page", () => {
    const p = placeLabel({ ...base, pageRotation: 0, position: "bottom-center" });
    expect(p).toEqual({ x: 290, y: 24, rotation: 0 });
  });
  it("puts the visual bottom-left near the user-space bottom-right on a 90° page", () => {
    const p = placeLabel({ ...base, pageRotation: 90, position: "bottom-left" });
    expect(p).toEqual({ x: 576, y: 24, rotation: 90 });
  });
  it("mirrors both axes at 180° and handles 270° and negative angles", () => {
    expect(placeLabel({ ...base, pageRotation: 180, position: "bottom-left" })).toEqual({ x: 576, y: 776, rotation: 180 });
    expect(placeLabel({ ...base, pageRotation: 270, position: "bottom-left" })).toEqual({ x: 24, y: 776, rotation: 270 });
    expect(placeLabel({ ...base, pageRotation: -90, position: "bottom-left" }).rotation).toBe(270);
  });
  it("centers using the displayed width when the page is sideways", () => {
    // displayed width is the unrotated height (800): center origin = (800-20)/2 = 390 along user y
    const p = placeLabel({ ...base, pageRotation: 90, position: "bottom-center" });
    expect(p.y).toBe(390);
  });
});
