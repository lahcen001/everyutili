import { describe, expect, it } from "vitest";
import { generateTypeScript } from "@/lib/jsonToTypescript";

describe("generateTypeScript", () => {
  it("generates nested interfaces", () => {
    const out = generateTypeScript({ id: 1, name: "x", owner: { ok: true }, tags: ["a"] });
    expect(out).toContain("interface Root {");
    expect(out).toContain("owner: Owner;");
    expect(out).toContain("tags: string[];");
    expect(out).toContain("interface Owner {\n  ok: boolean;\n}");
  });
  it("detects optional keys and unions across array items", () => {
    const out = generateTypeScript({ list: [{ a: 1, b: "x" }, { a: "2" }] });
    expect(out).toContain("a: number | string;");
    expect(out).toContain("b?: string;");
  });
  it("makes nullable types a union with null", () => {
    expect(generateTypeScript({ v: [1, null] })).toContain("v: (number | null)[];");
    expect(generateTypeScript({ v: [] })).toContain("v: unknown[];");
  });
  it("applies root name, export, readonly and type alias options", () => {
    const out = generateTypeScript({ a: [1] }, { rootName: "api response", exportTypes: true, readonly: true, outputKind: "type" });
    expect(out).toContain("export type ApiResponse = {");
    expect(out).toContain("readonly a: readonly number[];");
  });
  it("quotes unsafe keys and handles a root array", () => {
    const out = generateTypeScript([{ "my-key": 1 }]);
    expect(out).toContain('"my-key": number;');
    expect(out).toContain("type Root = RootItem[];");
  });
  it("merges same-named objects instead of dropping one", () => {
    const out = generateTypeScript({ a: { address: { street: "x" } }, b: { address: { zip: 1 } } });
    expect(out.match(/interface Address/g)?.length).toBe(1);
    expect(out).toContain("street?: string;");
    expect(out).toContain("zip?: number;");
  });
  it("emits Zod with import, nullable, optional and inferred type", () => {
    const out = generateTypeScript({ n: [1, null], u: [{ a: 1 }, {}] }, { generateZod: true });
    expect(out).toContain('import { z } from "zod";');
    expect(out).toContain("z.array(z.number().nullable())");
    expect(out).toContain("a: z.number().optional(),");
    expect(out).toContain("type RootInferred = z.infer<typeof RootSchema>;");
    expect(out.indexOf("const UItemSchema")).toBeLessThan(out.indexOf("const RootSchema"));
  });
  it("handles scalars at the root", () => {
    expect(generateTypeScript(5)).toContain("type Root = number;");
  });
});
