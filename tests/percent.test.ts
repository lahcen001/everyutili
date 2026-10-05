import { describe, expect, it } from "vitest";
import { beforeChange, decreaseBy, findWhole, formatNumber, increaseBy, parseNumber, percentChange, percentOf, whatPercent } from "@/lib/finance/percent";

describe("percentage maths", () => {
  it("computes the basics", () => {
    expect(percentOf(20, 150)).toBe(30);
    expect(whatPercent(30, 120)).toBe(25);
    expect(percentChange(80, 100)).toBe(25);
    expect(percentChange(100, 80)).toBe(-20);
    expect(increaseBy(100, 20)).toBe(120);
    expect(decreaseBy(100, 20)).toBe(80);
    expect(findWhole(30, 20)).toBe(150);
  });

  it("returns NaN, not 0, when the answer is undefined", () => {
    expect(whatPercent(5, 0)).toBeNaN();
    expect(percentChange(0, 50)).toBeNaN();
    expect(findWhole(5, 0)).toBeNaN();
    expect(beforeChange(50, 100, "decrease")).toBeNaN();
  });

  it("works backwards from a result", () => {
    expect(beforeChange(120, 20, "increase")).toBeCloseTo(100);
    expect(beforeChange(80, 20, "decrease")).toBeCloseTo(100);
    // 20% off then 25% back on does not return to the start
    expect(increaseBy(decreaseBy(100, 20), 25)).toBeCloseTo(100);
    expect(increaseBy(decreaseBy(100, 20), 20)).toBeCloseTo(96);
  });

  it("measures change against the size of a negative starting value", () => {
    expect(percentChange(-100, -50)).toBe(50);
    expect(percentChange(-100, -150)).toBe(-50);
  });

  it("parses user text safely", () => {
    expect(parseNumber("1,250.5")).toBe(1250.5);
    expect(parseNumber("  ")).toBeNaN();
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("-3")).toBe(-3);
  });

  it("formats numbers and dashes for NaN/Infinity", () => {
    expect(formatNumber(1234.56789)).toBe("1,234.5679");
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
  });
});
