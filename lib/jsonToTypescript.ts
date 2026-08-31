/**
 * Dependency-free JSON -> TypeScript (and Zod-shape-as-text) generator.
 * Walks a parsed JSON value, infers a shape tree, then renders that tree
 * as interfaces/type aliases and, optionally, a Zod schema block.
 */

export type OutputKind = "interface" | "type";

export interface GenerateOptions {
  outputKind: OutputKind;
  optionalFields: boolean;
  generateZod: boolean;
}

type Shape =
  | { kind: "primitive"; type: "string" | "number" | "boolean" | "null" }
  | { kind: "unknown" }
  | { kind: "array"; item: Shape }
  | { kind: "object"; name: string; fields: Map<string, Shape> };

function pascalCase(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr: string | undefined) =>
    chr ? chr.toUpperCase() : ""
  );
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /^[0-9]/.test(capitalized) ? `_${capitalized}` : capitalized || "Value";
}

function mergeShapes(a: Shape, b: Shape): Shape {
  if (a.kind === "unknown") return b;
  if (b.kind === "unknown") return a;

  if (a.kind === "primitive" && b.kind === "primitive") {
    return a.type === b.type ? a : { kind: "unknown" };
  }

  if (a.kind === "array" && b.kind === "array") {
    return { kind: "array", item: mergeShapes(a.item, b.item) };
  }

  if (a.kind === "object" && b.kind === "object") {
    const fields = new Map<string, Shape>(a.fields);
    for (const [key, shape] of b.fields) {
      fields.set(key, fields.has(key) ? mergeShapes(fields.get(key)!, shape) : shape);
    }
    return { kind: "object", name: a.name, fields };
  }

  return { kind: "unknown" };
}

function inferShape(value: unknown, name: string): Shape {
  if (value === null) return { kind: "primitive", type: "null" };

  if (typeof value === "string") return { kind: "primitive", type: "string" };
  if (typeof value === "number") return { kind: "primitive", type: "number" };
  if (typeof value === "boolean") return { kind: "primitive", type: "boolean" };

  if (Array.isArray(value)) {
    const itemName = `${name}Item`;
    if (value.length === 0) return { kind: "array", item: { kind: "unknown" } };
    const itemShape = value
      .map((item) => inferShape(item, itemName))
      .reduce((acc, shape) => mergeShapes(acc, shape));
    return { kind: "array", item: itemShape };
  }

  if (typeof value === "object") {
    const fields = new Map<string, Shape>();
    for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
      fields.set(key, inferShape(fieldValue, pascalCase(key)));
    }
    return { kind: "object", name, fields };
  }

  return { kind: "unknown" };
}

function collectObjectShapes(shape: Shape, out: Map<string, Shape>): void {
  if (shape.kind === "object") {
    if (!out.has(shape.name)) {
      out.set(shape.name, shape);
      for (const fieldShape of shape.fields.values()) collectObjectShapes(fieldShape, out);
    }
  } else if (shape.kind === "array") {
    collectObjectShapes(shape.item, out);
  }
}

function renderTypeRef(shape: Shape): string {
  switch (shape.kind) {
    case "primitive":
      return shape.type;
    case "unknown":
      return "unknown";
    case "array":
      return `${renderTypeRef(shape.item)}[]`;
    case "object":
      return shape.name;
  }
}

function renderShapeBody(shape: Extract<Shape, { kind: "object" }>, optionalFields: boolean): string {
  const lines: string[] = [];
  for (const [key, fieldShape] of shape.fields) {
    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    const optionalMark = optionalFields ? "?" : "";
    lines.push(`  ${safeKey}${optionalMark}: ${renderTypeRef(fieldShape)};`);
  }
  return lines.join("\n");
}

export function generateTypeScript(value: unknown, options: GenerateOptions): string {
  const rootShape = inferShape(value, "Root");

  if (rootShape.kind !== "object" && rootShape.kind !== "array") {
    return options.outputKind === "interface"
      ? `type Root = ${renderTypeRef(rootShape)};\n`
      : `type Root = ${renderTypeRef(rootShape)};\n`;
  }

  const objectShapes = new Map<string, Shape>();
  collectObjectShapes(rootShape, objectShapes);

  const blocks: string[] = [];

  if (rootShape.kind === "array" && objectShapes.size === 0) {
    blocks.push(`type Root = ${renderTypeRef(rootShape)};`);
  } else {
    for (const shape of objectShapes.values()) {
      if (shape.kind !== "object") continue;
      const body = renderShapeBody(shape, options.optionalFields);
      if (options.outputKind === "interface") {
        blocks.push(`interface ${shape.name} {\n${body}\n}`);
      } else {
        blocks.push(`type ${shape.name} = {\n${body}\n};`);
      }
    }

    if (rootShape.kind === "array") {
      blocks.push(`type Root = ${renderTypeRef(rootShape)};`);
    }
  }

  return `${blocks.join("\n\n")}\n`;
}

function zodPrimitive(type: "string" | "number" | "boolean" | "null"): string {
  if (type === "null") return "z.null()";
  return `z.${type}()`;
}

function renderZodRef(shape: Shape, optionalFields: boolean): string {
  switch (shape.kind) {
    case "primitive": {
      const base = zodPrimitive(shape.type);
      return optionalFields ? `${base}.optional()` : base;
    }
    case "unknown":
      return optionalFields ? "z.unknown().optional()" : "z.unknown()";
    case "array": {
      const base = `z.array(${renderZodRef(shape.item, false)})`;
      return optionalFields ? `${base}.optional()` : base;
    }
    case "object": {
      const base = `${shape.name}Schema`;
      return optionalFields ? `${base}.optional()` : base;
    }
  }
}

function renderZodObjectBody(shape: Extract<Shape, { kind: "object" }>, optionalFields: boolean): string {
  const lines: string[] = [];
  for (const [key, fieldShape] of shape.fields) {
    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    lines.push(`  ${safeKey}: ${renderZodRef(fieldShape, optionalFields)},`);
  }
  return lines.join("\n");
}

export function generateZodSchema(value: unknown, optionalFields: boolean): string {
  const rootShape = inferShape(value, "Root");

  if (rootShape.kind !== "object" && rootShape.kind !== "array") {
    return `const RootSchema = ${renderZodRef(rootShape, false)};\n`;
  }

  const objectShapes = new Map<string, Shape>();
  collectObjectShapes(rootShape, objectShapes);

  const blocks: string[] = [];

  for (const shape of objectShapes.values()) {
    if (shape.kind !== "object") continue;
    const body = renderZodObjectBody(shape, optionalFields);
    blocks.push(`const ${shape.name}Schema = z.object({\n${body}\n});`);
  }

  if (rootShape.kind === "array") {
    blocks.push(`const RootSchema = ${renderZodRef(rootShape, false)};`);
  }

  return `${blocks.join("\n\n")}\n`;
}
