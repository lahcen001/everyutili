import { describe, expect, it } from "vitest";
import { csvToJsonText, inferValue, parseCsv } from "@/lib/csv";
import { jsonToCsv } from "@/lib/jsonToCsv";

describe("parseCsv / csvToJsonText", () => {
  it("handles quoted fields with commas, quotes and newlines", () => {
    const r = csvToJsonText('name,note\n"Smith, John","line1\nline2"\n"Say ""hi""",x\n');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = JSON.parse(r.text);
      expect(v).toHaveLength(2);
      expect(v[0]).toEqual({ name: "Smith, John", note: "line1\nline2" });
      expect(v[1].name).toBe('Say "hi"');
    }
  });
  it("auto-detects semicolons and tabs", () => {
    const a = parseCsv("a;b\n1;2");
    expect(a.ok && a.data.delimiter).toBe(";");
    const b = parseCsv("a\tb\n1\t2");
    expect(b.ok && b.data.delimiter).toBe("\t");
  });
  it("infers types but keeps long ids and leading zeros as text", () => {
    expect(inferValue("12", false)).toBe(12);
    expect(inferValue("-3.5", false)).toBe(-3.5);
    expect(inferValue("007", false)).toBe("007");
    expect(inferValue("12345678901234567890", false)).toBe("12345678901234567890");
    expect(inferValue("TRUE", false)).toBe(true);
    expect(inferValue("", true)).toBeNull();
    expect(inferValue("1e5", false)).toBe(1e5);
  });
  it("strips a BOM and makes duplicate headers unique", () => {
    const r = parseCsv("﻿a,a,\n1,2,3");
    expect(r.ok && r.data.columns).toEqual(["a", "a_2", "column_3"]);
    expect(r.ok && r.data.warnings.length).toBe(1);
  });
  it("works without a header and warns about ragged rows", () => {
    const r = parseCsv("1,2,3\n4,5", { header: false });
    expect(r.ok && r.data.columns).toEqual(["column_1", "column_2", "column_3"]);
    expect(r.ok && r.data.rows[1]).toEqual([4, 5, ""]);
    expect(r.ok && r.data.warnings[0]).toContain("different number");
  });
  it("can output arrays instead of objects, trims, and rejects empty input", () => {
    const r = csvToJsonText(" a , b \n 1 , 2 ", { trim: true, asObjects: false, indent: 0 });
    expect(r.ok && JSON.parse(r.text)).toEqual([["a", "b"], [1, 2]]);
    expect(parseCsv("  ").ok).toBe(false);
  });
});

describe("jsonToCsv", () => {
  it("flattens nested objects and keeps union of columns", () => {
    const csv = jsonToCsv([{ a: 1, b: { c: 2 } }, { a: 3, d: "x" }]);
    expect(csv).toBe("a,b.c,d\n1,2,\n3,,x");
  });
  it("quotes delimiters, quotes, CR/LF and edge spaces", () => {
    const csv = jsonToCsv([{ t: 'a,b', u: 'say "x"', v: "l1\r\nl2", w: " pad" }]);
    expect(csv).toBe('t,u,v,w\n"a,b","say ""x""","l1\r\nl2"," pad"');
  });
  it("handles arrays, empty objects, primitives and null", () => {
    expect(jsonToCsv([{ a: [1, 2], b: {}, c: null }])).toBe('a,b,c\n"[1,2]",{},');
    expect(jsonToCsv([{ a: [1, 2] }], { arrays: "join", delimiter: ";" })).toBe(`a\n"1; 2"`);
    expect(jsonToCsv([1, 2])).toBe("value\n1\n2");
    expect(jsonToCsv({ a: 1 })).toBe("a\n1");
  });
  it("supports delimiter, no header, quote all, BOM", () => {
    expect(jsonToCsv([{ a: 1, b: 2 }], { delimiter: "\t", header: false })).toBe("1\t2");
    expect(jsonToCsv([{ a: 1 }], { quoteAll: true })).toBe('"a"\n"1"');
    expect(jsonToCsv([{ a: 1 }], { bom: true }).charCodeAt(0)).toBe(0xfeff);
  });
  it("guards against formula injection only for text", () => {
    const csv = jsonToCsv([{ a: "=SUM(A1)", b: -5, c: "@x" }], { formulaGuard: true });
    expect(csv).toBe("a,b,c\n'=SUM(A1),-5,'@x");
  });
  it("keeps nested objects as JSON when flatten is off", () => {
    expect(jsonToCsv([{ a: { b: 1 } }], { flatten: false })).toBe('a\n"{""b"":1}"');
  });
});
