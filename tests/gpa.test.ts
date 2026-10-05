import { describe, expect, it } from "vitest";
import { calculateGpa, cumulativeGpa, gpaNeeded, gradePoints } from "@/lib/finance/gpa";

describe("gpa", () => {
  it("handles D- and A+ per scale", () => {
    expect(gradePoints("D-", "4.0")).toBe(0.7);
    expect(gradePoints("A+", "4.0")).toBe(4);
    expect(gradePoints("A+", "4.3")).toBe(4.3);
  });
  it("weights honors/AP but not failing grades", () => {
    const r = calculateGpa([{ grade: "A", credits: 4, level: "ap" }, { grade: "B", credits: 4, level: "honors" }, { grade: "F", credits: 2, level: "ap" }], "4.0");
    expect(r.unweighted).toBeCloseTo((16 + 12) / 10);
    expect(r.weighted).toBeCloseTo((20 + 14 + 0) / 10);
  });
  it("ignores zero-credit courses", () => {
    expect(calculateGpa([{ grade: "A", credits: 0, level: "regular" }], "4.0").credits).toBe(0);
  });
  it("combines cumulative", () => {
    expect(cumulativeGpa(12, 4, 3, 60)).toBeCloseTo((12 + 180) / 64);
  });
  it("computes needed GPA", () => {
    expect(gpaNeeded(3.5, 90, 30, 30)).toBeCloseTo(4);
  });
});
