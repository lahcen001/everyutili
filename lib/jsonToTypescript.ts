/**
 * Dependency-free JSON -> TypeScript (and Zod) generator.
 * Walks a parsed JSON value, infers a shape tree (merging array items so unions and
 * optional keys are detected), then renders interfaces/type aliases and optionally Zod.
 */

export type OutputKind = "interface" | "type";

export interface GenerateOptions {
  outputKind: OutputKind;
  /** mark every field optional, instead of only the ones missing from some array items */
  optionalFields: boolean;
  generateZod: boolean;
  rootName: string;
  exportTypes: boolean;
  readonly: boolean;
}

export const DEFAULT_OPTIONS: GenerateOptions = {
  outputKind: "interface",
  optionalFields: false,
  generateZod: false,
  rootName: "Root",
  exportTypes: false,
  readonly: false,
};

type Prim = "string" | "number" | "boolean" | "null";

type Shape =
  | { kind: "primitive"; type: Prim }
  | { kind: "unknown" }
  | { kind: "union"; members: Shape[] }
  | { kind: "array"; item: Shape }
  | { kind: "object"; name: string; fields: Map<string, Field> };

interface Field {
  shape: Shape;
  optional: boolean;
}

export function pascalCase(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr: string | undefined) => (chr ? chr.toUpperCase() : ""));
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /^[0-9]/.test(capitalized) ? `_${capitalized}` : capitalized || "Value";
}

const same = (a: Shape, b: Shape) => a.kind === b.kind && (a.kind !== "primitive" || a.type === (b as typeof a).type) && (a.kind !== "object" || a.name === (b as typeof a).name);

function union(a: Shape, b: Shape): Shape {
  const members: Shape[] = [];
  const add = (s: Shape) => {
    if (s.kind === "union") return s.members.forEach(add);
    const existing = members.findIndex((m) => same(m, s));
    if (existing === -1) members.push(s);
    else members[existing] = mergeShapes(members[existing], s);
  };
  add(a);
  add(b);
  return members.length === 1 ? members[0] : { kind: "union", members };
}

function mergeShapes(a: Shape, b: Shape): Shape {
  if (a.kind === "unknown") return b;
  if (b.kind === "unknown") return a;
  if (a.kind === "array" && b.kind === "array") return { kind: "array", item: mergeShapes(a.item, b.item) };
  if (a.kind === "object" && b.kind === "object") {
    const fields = new Map<string, Field>();
    for (const [key, f] of a.fields) {
      const other = b.fields.get(key);
      fields.set(key, other ? { shape: mergeShapes(f.shape, other.shape), optional: f.optional || other.optional } : { ...f, optional: true });
    }
    for (const [key, f] of b.fields) if (!a.fields.has(key)) fields.set(key, { ...f, optional: true });
    return { kind: "object", name: a.name, fields };
  }
  if (same(a, b) && a.kind === "primitive") return a;
  return union(a, b);
}

function inferShape(value: unknown, name: string): Shape {
  if (value === null) return { kind: "primitive", type: "null" };
  if (typeof value === "string") return { kind: "primitive", type: "string" };
  if (typeof value === "number") return { kind: "primitive", type: "number" };
  if (typeof value === "boolean") return { kind: "primitive", type: "boolean" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "array", item: { kind: "unknown" } };
    const itemName = `${name}Item`;
    return { kind: "array", item: value.map((v) => inferShape(v, itemName)).reduce((acc, s) => mergeShapes(acc, s)) };
  }
  if (typeof value === "object") {
    const fields = new Map<string, Field>();
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) fields.set(key, { shape: inferShape(v, pascalCase(key)), optional: false });
    return { kind: "object", name, fields };
  }
  return { kind: "unknown" };
}

/** Every distinct object shape by name; shapes sharing a name are merged. */
function collectObjects(shape: Shape, out: Map<string, Extract<Shape, { kind: "object" }>>): void {
  if (shape.kind === "object") {
    const prev = out.get(shape.name);
    out.set(shape.name, prev ? (mergeShapes(prev, shape) as Extract<Shape, { kind: "object" }>) : shape);
    for (const f of shape.fields.values()) collectObjects(f.shape, out);
  } else if (shape.kind === "array") collectObjects(shape.item, out);
  else if (shape.kind === "union") shape.members.forEach((m) => collectObjects(m, out));
}

const safeKey = (key: string) => (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key));

function renderRef(shape: Shape, ro: boolean): string {
  switch (shape.kind) {
    case "primitive":
      return shape.type;
    case "unknown":
      return "unknown";
    case "object":
      return shape.name;
    case "array": {
      const inner = renderRef(shape.item, ro);
      const wrapped = shape.item.kind === "union" ? `(${inner})` : inner;
      return ro ? `readonly ${wrapped}[]` : `${wrapped}[]`;
    }
    case "union":
      return shape.members.map((m) => renderRef(m, ro)).join(" | ");
  }
}

function objectBody(shape: Extract<Shape, { kind: "object" }>, o: GenerateOptions): string {
  const lines: string[] = [];
  for (const [key, f] of shape.fields) {
    const opt = o.optionalFields || f.optional ? "?" : "";
    lines.push(`  ${o.readonly ? "readonly " : ""}${safeKey(key)}${opt}: ${renderRef(f.shape, o.readonly)};`);
  }
  return lines.join("\n");
}

function renderTypes(root: Shape, o: GenerateOptions): string {
  const exp = o.exportTypes ? "export " : "";
  const objects = new Map<string, Extract<Shape, { kind: "object" }>>();
  collectObjects(root, objects);
  const blocks: string[] = [];
  for (const shape of objects.values()) {
    const body = objectBody(shape, o);
    blocks.push(o.outputKind === "interface" ? `${exp}interface ${shape.name} {\n${body}\n}` : `${exp}type ${shape.name} = {\n${body}\n};`);
  }
  if (root.kind !== "object") blocks.push(`${exp}type ${o.rootName} = ${renderRef(root, o.readonly)};`);
  return blocks.join("\n\n");
}

function zodRef(shape: Shape): string {
  switch (shape.kind) {
    case "primitive":
      return shape.type === "null" ? "z.null()" : `z.${shape.type}()`;
    case "unknown":
      return "z.unknown()";
    case "object":
      return `${shape.name}Schema`;
    case "array":
      return `z.array(${zodRef(shape.item)})`;
    case "union": {
      const nonNull = shape.members.filter((m) => !(m.kind === "primitive" && m.type === "null"));
      const hasNull = nonNull.length !== shape.members.length;
      const core = nonNull.length === 1 ? zodRef(nonNull[0]) : `z.union([${nonNull.map(zodRef).join(", ")}])`;
      return hasNull ? `${core}.nullable()` : core;
    }
  }
}

function renderZod(root: Shape, o: GenerateOptions): string {
  const exp = o.exportTypes ? "export " : "";
  const objects = new Map<string, Extract<Shape, { kind: "object" }>>();
  collectObjects(root, objects);
  // children before parents, so each schema is declared before it is used
  const ordered: Extract<Shape, { kind: "object" }>[] = [];
  const seen = new Set<string>();
  const visit = (shape: Shape) => {
    if (shape.kind === "object") {
      if (seen.has(shape.name)) return;
      seen.add(shape.name);
      const merged = objects.get(shape.name)!;
      for (const f of merged.fields.values()) visit(f.shape);
      ordered.push(merged);
    } else if (shape.kind === "array") visit(shape.item);
    else if (shape.kind === "union") shape.members.forEach(visit);
  };
  visit(root);
  const blocks = ordered.map((s) => {
    const body = [...s.fields].map(([k, f]) => `  ${safeKey(k)}: ${zodRef(f.shape)}${o.optionalFields || f.optional ? ".optional()" : ""},`).join("\n");
    return `${exp}const ${s.name}Schema = z.object({\n${body}\n});`;
  });
  if (root.kind !== "object") blocks.push(`${exp}const ${o.rootName}Schema = ${zodRef(root)};`);
  blocks.push(`${exp}type ${o.rootName}Inferred = z.infer<typeof ${o.rootName}Schema>;`);
  return `import { z } from "zod";\n\n${blocks.join("\n\n")}`;
}

export function generateTypeScript(value: unknown, options: Partial<GenerateOptions> = {}): string {
  const o: GenerateOptions = { ...DEFAULT_OPTIONS, ...options, rootName: pascalCase(options.rootName?.trim() || "Root") };
  const root = inferShape(value, o.rootName);
  const types = renderTypes(root, o);
  return o.generateZod ? `${types}\n\n${renderZod(root, o)}\n` : `${types}\n`;
}

/** Kept for callers that only want the Zod block. */
export function generateZodSchema(value: unknown, optionalFields = false, rootName = "Root"): string {
  const o: GenerateOptions = { ...DEFAULT_OPTIONS, optionalFields, rootName: pascalCase(rootName) };
  return `${renderZod(inferShape(value, o.rootName), o)}\n`;
}
