import { describe, expect, it } from "vitest";
import { normalizeFlags, runRegex } from "@/lib/regex";
import { explainFlags, explainRegex } from "@/lib/regexExplain";

const base = { flags: "g", mode: "match" as const, replacement: "" };

describe("runRegex", () => {
  it("finds all matches with positions, groups and named groups", () => {
    const r = runRegex({ ...base, pattern: "(?<k>\\w+)=(\\d+)", text: "a=1, bb=22" });
    expect(r.ok).toBe(true);
    expect(r.total).toBe(2);
    expect(r.matches[1]).toMatchObject({ index: 5, end: 10, text: "bb=22", groups: ["bb", "22"], named: { k: "bb" } });
    expect(r.matches[1].ranges?.[1]).toEqual([8, 10]);
  });
  it("honours the g flag: without it only the first match is returned", () => {
    expect(runRegex({ ...base, flags: "", pattern: "a", text: "aaa" }).total).toBe(1);
    expect(runRegex({ ...base, flags: "g", pattern: "a", text: "aaa" }).total).toBe(3);
  });
  it("supports i, m, s flags", () => {
    expect(runRegex({ ...base, flags: "gi", pattern: "abc", text: "ABC abc" }).total).toBe(2);
    expect(runRegex({ ...base, flags: "gm", pattern: "^x", text: "x\nx" }).total).toBe(2);
    expect(runRegex({ ...base, flags: "g", pattern: "a.b", text: "a\nb" }).total).toBe(0);
    expect(runRegex({ ...base, flags: "gs", pattern: "a.b", text: "a\nb" }).total).toBe(1);
  });
  it("handles zero-length matches without looping forever", () => {
    expect(runRegex({ ...base, pattern: "x*", text: "ab" }).total).toBe(3);
  });
  it("reports invalid patterns without the browser prefix", () => {
    const r = runRegex({ ...base, pattern: "(", text: "x" });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.error).not.toMatch(/^Invalid regular expression/);
  });
  it("caps the number of returned matches", () => {
    const r = runRegex({ ...base, pattern: "a", text: "a".repeat(50), limit: 10 });
    expect(r.matches).toHaveLength(10);
    expect(r.total).toBe(50);
    expect(r.truncated).toBe(true);
  });
  it("replaces with $1, $<name> and $&", () => {
    expect(runRegex({ ...base, mode: "replace", pattern: "(\\w+)@(\\w+)", replacement: "$2:$1", text: "me@site" }).replaced).toBe("site:me");
    expect(runRegex({ ...base, mode: "replace", pattern: "(?<n>\\d)", replacement: "[$<n>]", text: "a1b2" }).replaced).toBe("a[1]b[2]");
    expect(runRegex({ ...base, mode: "replace", flags: "", pattern: "a", replacement: "-", text: "aaa" }).replaced).toBe("-aa");
  });
  it("splits", () => {
    expect(runRegex({ ...base, mode: "split", pattern: "\\s*,\\s*", text: "a , b,c" }).parts).toEqual(["a", "b", "c"]);
  });
  it("normalizes flags", () => {
    expect(normalizeFlags("zgigx")).toBe("gi");
  });
  it("supports unicode and sticky flags", () => {
    expect(runRegex({ ...base, flags: "gu", pattern: "\\p{L}+", text: "héllo wörld" }).total).toBe(2);
    expect(runRegex({ ...base, flags: "gy", pattern: "a", text: "aab" }).total).toBe(2);
  });
});

describe("explainRegex", () => {
  it("describes tokens, groups and quantifiers", () => {
    const e = explainRegex("^(?<year>\\d{4})-(\\d{2})$");
    const meanings = e.map((x) => x.meaning).join("|");
    expect(e[0].token).toBe("^");
    expect(meanings).toContain('named capture group "year"');
    expect(meanings).toContain("a digit");
    expect(meanings).toContain("exactly 4 times");
    expect(e.some((x) => x.token === "-" || x.meaning.includes('"-"'))).toBe(true);
    expect(e.find((x) => x.token === "$")).toBeTruthy();
  });
  it("describes sets, lazy quantifiers, lookarounds and alternation", () => {
    const e = explainRegex("[^a-z]+?(?=x)|b*");
    const text = e.map((x) => x.meaning).join("|");
    expect(text).toContain("any character except: a-z");
    expect(text).toContain("as few as possible");
    expect(text).toContain("positive lookahead");
    expect(text).toContain("or");
    expect(text).toContain("zero or more");
  });
  it("applies a quantifier only to the last literal character", () => {
    const e = explainRegex("abc+");
    expect(e.map((x) => x.token)).toEqual(["ab", "c", "+"]);
  });
  it("explains flags", () => {
    expect(explainFlags("gi")).toHaveLength(2);
  });
});
