import { describe, expect, it } from "vitest";
import { diffStats, normalizeEol, unifiedPatch } from "@/lib/diffText";

const off = { ignoreWhitespace: false, ignoreCase: false };

describe("diffStats", () => {
  it("counts added, removed and unchanged lines", () => {
    expect(diffStats("a\nb\nc\n", "a\nx\nc\nd\n", off)).toMatchObject({ added: 2, removed: 1, unchanged: 2, identical: false });
  });
  it("reports identical text, ignoring CRLF", () => {
    expect(diffStats("a\r\nb", "a\nb", off).identical).toBe(true);
  });
  it("can ignore whitespace and case", () => {
    expect(diffStats("Hello  world\n", "hello world\n", off).identical).toBe(false);
    expect(diffStats("Hello  world\n", "hello world\n", { ignoreWhitespace: true, ignoreCase: true }).identical).toBe(true);
  });
  it("handles large inputs without exhausting memory", () => {
    const a = Array.from({ length: 20000 }, (_, i) => `line ${i}`).join("\n");
    const b = a.replace("line 10000", "changed");
    const t = diffStats(a, b, off);
    expect(t.added).toBe(1);
    expect(t.removed).toBe(1);
  });
});

describe("unifiedPatch", () => {
  it("makes a standard unified diff", () => {
    const p = unifiedPatch("x\ny\n", "x\nz\n", off, { original: "a.txt", modified: "b.txt" });
    expect(p).toContain("--- a.txt");
    expect(p).toContain("+++ b.txt");
    expect(p).toContain("-y");
    expect(p).toContain("+z");
  });
  it("normalizeEol", () => {
    expect(normalizeEol("a\r\nb\rc")).toBe("a\nb\nc");
  });
});
