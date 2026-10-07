import { describe, expect, it } from "vitest";
import { jsonStats, minifyJsonAst, offsetToLineCol, parseJsonAst, printJson, repairJson, toTableRows } from "@/lib/json";
import { queryJsonPath } from "@/lib/jsonPath";

const ok = (t: string) => {
  const r = parseJsonAst(t);
  if (!r.ok) throw new Error(`${r.error.message} @${r.error.line}:${r.error.column}`);
  return r.ast;
};

describe("parseJsonAst / printJson", () => {
  it("keeps big numbers and number formatting exactly", () => {
    const out = printJson(ok('{"id":12345678901234567890,"v":1.0,"e":1E5}'), { indent: 2, sortKeys: false });
    expect(out).toContain("12345678901234567890");
    expect(out).toContain("1.0");
    expect(out).toContain("1E5");
  });
  it("formats with indent options and tabs", () => {
    const a = ok('{"a":[1,2],"b":{}}');
    expect(printJson(a, { indent: 2, sortKeys: false })).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": {}\n}');
    expect(printJson(a, { indent: "tab", sortKeys: false })).toContain('\n\t"a"');
    expect(printJson(a, { indent: 4, sortKeys: false })).toContain('\n    "a"');
  });
  it("sorts keys and minifies", () => {
    const a = ok('{"b":1,"a":{"d":1,"c":2}}');
    expect(minifyJsonAst(a, true)).toBe('{"a":{"c":2,"d":1},"b":1}');
    expect(minifyJsonAst(a)).toBe('{"b":1,"a":{"d":1,"c":2}}');
  });
  it("round-trips real JSON", () => {
    const src = '{"x":[true,false,null,"é\\n\\u00e9",-0.5e-3],"y":{"z":[]}}';
    expect(JSON.parse(minifyJsonAst(ok(src)))).toEqual(JSON.parse(src));
  });
  it("reports line and column", () => {
    const r = parseJsonAst('{\n  "a": 1,\n  "b": ,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBe(8);
    }
  });
  it("rejects trailing commas, bad escapes, control chars, trailing junk, empty input", () => {
    expect(parseJsonAst("[1,]").ok).toBe(false);
    expect(parseJsonAst('{"a":1,}').ok).toBe(false);
    expect(parseJsonAst('"\\q"').ok).toBe(false);
    expect(parseJsonAst('"a\nb"').ok).toBe(false);
    expect(parseJsonAst("1 2").ok).toBe(false);
    expect(parseJsonAst("  ").ok).toBe(false);
    expect(parseJsonAst('{"a":').ok).toBe(false);
    expect(parseJsonAst("01").ok).toBe(false);
  });
  it("accepts scalars at the root and survives deep nesting", () => {
    expect(parseJsonAst("42").ok).toBe(true);
    expect(parseJsonAst('"x"').ok).toBe(true);
    expect(parseJsonAst("[".repeat(1500) + "]".repeat(1500)).ok).toBe(true);
    expect(parseJsonAst("[".repeat(5000)).ok).toBe(false);
  });
  it("offsetToLineCol", () => {
    expect(offsetToLineCol("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });
  it("stats", () => {
    expect(jsonStats(ok('{"a":[1,{"b":2}]}'))).toMatchObject({ depth: 4, keys: 2, arrays: 1, objects: 2 });
  });
});

describe("repairJson", () => {
  it("fixes comments, trailing commas, single quotes, unquoted keys, python literals", () => {
    const { text, fixes } = repairJson("{ // c\n a: 'it\\'s', b: [1,2,], /* x */ c: True, d: None, }");
    expect(JSON.parse(text)).toEqual({ a: "it's", b: [1, 2], c: true, d: null });
    expect(fixes.length).toBeGreaterThan(3);
  });
  it("leaves strings with comment-like text alone", () => {
    const { text } = repairJson('{"u":"http://x.y/#a // b"}');
    expect(JSON.parse(text)).toEqual({ u: "http://x.y/#a // b" });
  });
});

describe("toTableRows", () => {
  it("builds columns from arrays of objects", () => {
    const t = toTableRows([{ a: 1 }, { a: 2, b: 3 }])!;
    expect(t.columns).toEqual(["a", "b"]);
    expect(toTableRows([1, 2])).toBeNull();
    expect(toTableRows({ x: { a: 1 }, y: { a: 2 } })!.rows).toHaveLength(2);
  });
});

describe("queryJsonPath", () => {
  const doc = { store: { book: [{ title: "A", price: 5 }, { title: "B", price: 15 }], bike: { price: 20 } } };
  it("child, index, wildcard, slice, negative index", () => {
    expect(queryJsonPath(doc, "$.store.book[0].title")[0].value).toBe("A");
    expect(queryJsonPath(doc, "$.store.book[-1].title")[0].value).toBe("B");
    expect(queryJsonPath(doc, "$.store.book[*].title").map((m) => m.value)).toEqual(["A", "B"]);
    expect(queryJsonPath(doc, "$.store.book[0:1]")).toHaveLength(1);
    expect(queryJsonPath(doc, "$['store']['bike'].price")[0].value).toBe(20);
  });
  it("recursive descent returns paths", () => {
    const m = queryJsonPath(doc, "$..price");
    expect(m.map((x) => x.value).sort()).toEqual([15, 20, 5]);
    expect(m.map((x) => x.path)).toContain("$.store.book[1].price");
  });
  it("returns nothing for misses and throws for bad paths", () => {
    expect(queryJsonPath(doc, "$.nope")).toEqual([]);
    expect(() => queryJsonPath(doc, "store")).toThrow();
    expect(() => queryJsonPath(doc, "$.a[")).toThrow();
  });
});
