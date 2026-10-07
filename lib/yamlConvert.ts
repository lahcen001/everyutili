import YAML from "yaml";
import { parseJsonAst } from "@/lib/json";

export interface ConvertFailure {
  message: string;
  line?: number;
  column?: number;
}

export type ConvertResult = { ok: true; text: string } | { ok: false; error: ConvertFailure };

export interface YamlOptions {
  indent: 2 | 4;
  sortKeys: boolean;
}

export function jsonToYaml(json: string, opts: YamlOptions): ConvertResult {
  const parsed = parseJsonAst(json);
  if (!parsed.ok) return { ok: false, error: { message: parsed.error.message, line: parsed.error.line, column: parsed.error.column } };
  try {
    const value = JSON.parse(json) as unknown;
    return { ok: true, text: YAML.stringify(value, { indent: opts.indent, lineWidth: 0, sortMapEntries: opts.sortKeys }) };
  } catch (e) {
    return { ok: false, error: { message: e instanceof Error ? e.message : "Could not convert" } };
  }
}

/** YAML → JSON. A file with several `---` documents becomes a JSON array. */
export function yamlToJson(yaml: string, opts: { indent: number | "tab"; sortKeys: boolean }): ConvertResult {
  try {
    const docs = YAML.parseAllDocuments(yaml, { merge: true });
    for (const doc of docs) {
      if (doc.errors.length > 0) {
        const err = doc.errors[0];
        const pos = err.linePos?.[0];
        return { ok: false, error: { message: err.message.split("\n")[0], line: pos?.line, column: pos?.col } };
      }
    }
    const values = docs.map((d) => d.toJS({ maxAliasCount: 1000 }) as unknown);
    const value = values.length === 1 ? values[0] : values;
    const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);
    const out = JSON.stringify(opts.sortKeys ? sort(value) : value, null, opts.indent === "tab" ? "\t" : opts.indent);
    return { ok: true, text: out === undefined ? "null" : out };
  } catch (e) {
    return { ok: false, error: { message: e instanceof Error ? e.message : "Could not convert" } };
  }
}
