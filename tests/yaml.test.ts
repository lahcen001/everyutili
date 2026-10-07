import { describe, expect, it } from "vitest";
import { jsonToYaml, yamlToJson } from "@/lib/yamlConvert";

const opts = { indent: 2 as const, sortKeys: false };

describe("jsonToYaml", () => {
  it("converts nested data and quotes ambiguous strings", () => {
    const r = jsonToYaml('{"a":1,"b":{"c":[1,2]},"s":"true","n":"123","e":"","t":"a: b"}', opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("a: 1");
      expect(r.text).toContain('s: "true"');
      expect(r.text).toContain('n: "123"');
      expect(r.text).toContain('t: "a: b"');
    }
  });
  it("honours indent and sort keys", () => {
    const r = jsonToYaml('{"b":{"x":1},"a":2}', { indent: 4, sortKeys: true });
    expect(r.ok && r.text.startsWith("a: 2")).toBe(true);
    expect(r.ok && r.text).toContain("\n    x: 1");
  });
  it("reports JSON errors with position", () => {
    const r = jsonToYaml('{"a":}', opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(1);
  });
});

describe("yamlToJson", () => {
  const o = { indent: 2, sortKeys: false };
  it("handles multiline strings, flow collections, quotes and comments", () => {
    const y = "title: Hello # comment\ntext: |\n  line1\n  line2\nfolded: >\n  a\n  b\nflow: {a: 1, b: [x, \"y,z\"]}\nq: \"a #b\"\n";
    const r = yamlToJson(y, o);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = JSON.parse(r.text);
      expect(v.title).toBe("Hello");
      expect(v.text).toBe("line1\nline2\n");
      expect(v.folded).toBe("a b\n");
      expect(v.flow).toEqual({ a: 1, b: ["x", "y,z"] });
      expect(v.q).toBe("a #b");
    }
  });
  it("resolves anchors and aliases", () => {
    const r = yamlToJson("base: &b {x: 1}\nuse: *b\n", o);
    expect(r.ok && JSON.parse(r.text).use).toEqual({ x: 1 });
  });
  it("expands merge keys", () => {
    const r = yamlToJson("a: &x {p: 1}\nb:\n  <<: *x\n  q: 2\n", o);
    expect(r.ok && JSON.parse(r.text).b).toEqual({ p: 1, q: 2 });
  });
  it("turns several documents into an array", () => {
    const r = yamlToJson("a: 1\n---\nb: 2\n", o);
    expect(r.ok && JSON.parse(r.text)).toEqual([{ a: 1 }, { b: 2 }]);
  });
  it("reports errors with line and column", () => {
    const r = yamlToJson("a: [1, 2\nb: 3\n", o);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBeGreaterThan(0);
  });
  it("sorts keys and supports tab indent", () => {
    const r = yamlToJson("b: 1\na: 2\n", { indent: "tab", sortKeys: true });
    expect(r.ok && r.text).toBe('{\n\t"a": 2,\n\t"b": 1\n}');
  });
});
