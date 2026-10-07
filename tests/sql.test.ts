import { describe, expect, it } from "vitest";
import { commaFirst, formatSql, minifySql } from "@/lib/sql";

const base = { dialect: "postgresql" as const, keywordCase: "upper" as const, indent: 2 as const, linesBetweenQueries: 1, commaFirst: false };

describe("formatSql", () => {
  it("formats, uppercases keywords and keeps comments", () => {
    const r = formatSql("select a,b from t -- why\nwhere x=1 /* note */ and y in (1,2)", base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("SELECT");
      expect(r.text).toContain("-- why");
      expect(r.text).toContain("/* note */");
      expect(r.text).toContain("\nFROM");
    }
  });
  it("supports dialects and tabs", () => {
    const r = formatSql("select [a] from t where x = 1", { ...base, dialect: "transactsql", indent: "tab" });
    expect(r.ok && r.text).toContain("[a]");
    expect(r.ok && r.text).toContain("\t");
  });
  it("reports parse errors with a short message and position", () => {
    const r = formatSql("select * from t where (a", base);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message.length).toBeLessThan(200);
      expect(r.error.line).toBe(1);
    }
  });
  it("moves commas to the front when asked", () => {
    const r = formatSql("select a, b, c from t", { ...base, commaFirst: true });
    expect(r.ok && r.text).toMatch(/\n\s*, b/);
    expect(commaFirst("a,\n  b")).toBe("a\n, b");
  });
});

describe("minifySql", () => {
  it("strips comments and collapses whitespace", () => {
    expect(minifySql("SELECT a ,\n  b\nFROM t -- c\nWHERE x = 1 /* d */ ;")).toBe("SELECT a,b FROM t WHERE x = 1;");
  });
  it("never touches strings or quoted identifiers", () => {
    expect(minifySql("select 'a  --  b', \"x  y\", `p  q`, [r  s] from t")).toBe("select 'a  --  b',\"x  y\",`p  q`,[r  s] from t");
  });
  it("handles escaped quotes and dollar bodies", () => {
    expect(minifySql("select 'it''s   ok'  ,  $$ a   b $$")).toBe("select 'it''s   ok',$$ a   b $$");
  });
  it("does not glue keywords together when a comment sits between them", () => {
    expect(minifySql("select/*x*/a")).toBe("select a");
  });
});
