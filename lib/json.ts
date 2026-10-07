/**
 * A small JSON parser that keeps number literals exactly as written (so
 * 12345678901234567890 and 1.0 survive formatting) and reports errors with a
 * line and column instead of a browser-specific message.
 */

export type JsonNode =
  | { t: "obj"; entries: { key: string; raw: string; value: JsonNode }[] }
  | { t: "arr"; items: JsonNode[] }
  | { t: "lit"; text: string };

export interface JsonError {
  message: string;
  offset: number;
  line: number;
  column: number;
}

export type ParseOutcome = { ok: true; ast: JsonNode } | { ok: false; error: JsonError };

export function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  }
  return { line, column: end - last };
}

class ParseFailure extends Error {
  constructor(
    message: string,
    public offset: number
  ) {
    super(message);
  }
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const MAX_DEPTH = 2000;

export function parseJsonAst(text: string): ParseOutcome {
  let i = 0;

  const describe = () => (i >= text.length ? "end of input" : `"${text[i]}"`);
  const skip = () => {
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  };
  const fail = (message: string, at = i): never => {
    throw new ParseFailure(message, at);
  };

  function parseString(): string {
    const start = i;
    i++; // opening quote
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        i++;
        return text.slice(start, i);
      }
      if (c < 32) fail("Control character in string (use \\n or \\t)", i);
      if (c === 92) {
        const n = text[i + 1];
        if (n === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail("Invalid \\u escape", i);
          i += 6;
        } else if (n !== undefined && '"\\/bfnrt'.includes(n)) i += 2;
        else fail(`Invalid escape "\\${n ?? ""}"`, i);
      } else i++;
    }
    return fail("Unterminated string", start);
  }

  function parseValue(depth: number): JsonNode {
    if (depth > MAX_DEPTH) fail("Nested too deeply");
    skip();
    const c = text[i];
    if (c === "{") {
      i++;
      const entries: { key: string; raw: string; value: JsonNode }[] = [];
      skip();
      if (text[i] === "}") {
        i++;
        return { t: "obj", entries };
      }
      for (;;) {
        skip();
        if (text[i] !== '"') fail(`Expected a property name in double quotes but found ${describe()}`);
        const raw = parseString();
        skip();
        if (text[i] !== ":") fail(`Expected ":" after property name but found ${describe()}`);
        i++;
        const value = parseValue(depth + 1);
        entries.push({ key: JSON.parse(raw) as string, raw, value });
        skip();
        if (text[i] === ",") {
          i++;
          skip();
          if (text[i] === "}") fail('Trailing comma before "}" is not allowed in JSON');
          continue;
        }
        if (text[i] === "}") {
          i++;
          return { t: "obj", entries };
        }
        fail(`Expected "," or "}" but found ${describe()}`);
      }
    }
    if (c === "[") {
      i++;
      const items: JsonNode[] = [];
      skip();
      if (text[i] === "]") {
        i++;
        return { t: "arr", items };
      }
      for (;;) {
        items.push(parseValue(depth + 1));
        skip();
        if (text[i] === ",") {
          i++;
          skip();
          if (text[i] === "]") fail('Trailing comma before "]" is not allowed in JSON');
          continue;
        }
        if (text[i] === "]") {
          i++;
          return { t: "arr", items };
        }
        fail(`Expected "," or "]" but found ${describe()}`);
      }
    }
    if (c === '"') return { t: "lit", text: parseString() };
    for (const word of ["true", "false", "null"]) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return { t: "lit", text: word };
      }
    }
    if (c === "-" || (c !== undefined && c >= "0" && c <= "9")) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(text);
      if (!m) fail("Invalid number");
      i += m![0].length;
      return { t: "lit", text: m![0] };
    }
    if (i >= text.length) fail("Unexpected end of input — the JSON is incomplete");
    return fail(`Unexpected ${describe()}`);
  }

  try {
    if (text.trim() === "") return { ok: false, error: { message: "Empty input", offset: 0, line: 1, column: 1 } };
    const ast = parseValue(0);
    skip();
    if (i < text.length) fail(`Unexpected ${describe()} after the end of the JSON value`);
    return { ok: true, ast };
  } catch (e) {
    if (e instanceof ParseFailure) {
      const { line, column } = offsetToLineCol(text, e.offset);
      return { ok: false, error: { message: e.message, offset: e.offset, line, column } };
    }
    if (e instanceof RangeError) return { ok: false, error: { message: "Nested too deeply", offset: 0, line: 1, column: 1 } };
    throw e;
  }
}

export interface PrintOptions {
  /** number of spaces, or "tab" */
  indent: number | "tab";
  sortKeys: boolean;
}

function sortedEntries(entries: { key: string; raw: string; value: JsonNode }[]) {
  return [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function printJson(ast: JsonNode, opts: PrintOptions): string {
  const unit = opts.indent === "tab" ? "\t" : " ".repeat(opts.indent);
  const out: string[] = [];
  const walk = (node: JsonNode, level: number) => {
    if (node.t === "lit") {
      out.push(node.text);
    } else if (node.t === "arr") {
      if (node.items.length === 0) return void out.push("[]");
      out.push("[\n");
      node.items.forEach((item, idx) => {
        out.push(unit.repeat(level + 1));
        walk(item, level + 1);
        out.push(idx < node.items.length - 1 ? ",\n" : "\n");
      });
      out.push(unit.repeat(level), "]");
    } else {
      if (node.entries.length === 0) return void out.push("{}");
      const entries = opts.sortKeys ? sortedEntries(node.entries) : node.entries;
      out.push("{\n");
      entries.forEach((e, idx) => {
        out.push(unit.repeat(level + 1), e.raw, ": ");
        walk(e.value, level + 1);
        out.push(idx < entries.length - 1 ? ",\n" : "\n");
      });
      out.push(unit.repeat(level), "}");
    }
  };
  walk(ast, 0);
  return out.join("");
}

export function minifyJsonAst(ast: JsonNode, sortKeys = false): string {
  const out: string[] = [];
  const walk = (node: JsonNode) => {
    if (node.t === "lit") out.push(node.text);
    else if (node.t === "arr") {
      out.push("[");
      node.items.forEach((item, idx) => {
        if (idx) out.push(",");
        walk(item);
      });
      out.push("]");
    } else {
      out.push("{");
      (sortKeys ? sortedEntries(node.entries) : node.entries).forEach((e, idx) => {
        if (idx) out.push(",");
        out.push(e.raw, ":");
        walk(e.value);
      });
      out.push("}");
    }
  };
  walk(ast);
  return out.join("");
}

export interface JsonStats {
  depth: number;
  keys: number;
  values: number;
  arrays: number;
  objects: number;
}

export function jsonStats(ast: JsonNode): JsonStats {
  const s: JsonStats = { depth: 0, keys: 0, values: 0, arrays: 0, objects: 0 };
  const walk = (node: JsonNode, depth: number) => {
    s.depth = Math.max(s.depth, depth);
    s.values++;
    if (node.t === "arr") {
      s.arrays++;
      node.items.forEach((n) => walk(n, depth + 1));
    } else if (node.t === "obj") {
      s.objects++;
      s.keys += node.entries.length;
      node.entries.forEach((e) => walk(e.value, depth + 1));
    }
  };
  walk(ast, 1);
  return s;
}

/**
 * Turn "relaxed JSON" (comments, trailing commas, single quotes, unquoted keys,
 * Python/JS literals) into strict JSON text. Returns the repaired text and
 * a short list of what was changed.
 */
export function repairJson(input: string): { text: string; fixes: string[] } {
  const fixes = new Set<string>();
  let out = "";
  let i = 0;
  const n = input.length;
  const isIdStart = (c: string) => /[A-Za-z_$]/.test(c);
  const isId = (c: string) => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = input[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && input[j] !== '"') j += input[j] === "\\" ? 2 : 1;
      out += input.slice(i, j + 1);
      i = j + 1;
    } else if (c === "'") {
      let j = i + 1;
      let body = "";
      while (j < n && input[j] !== "'") {
        if (input[j] === "\\" && input[j + 1] === "'") {
          body += "'";
          j += 2;
        } else if (input[j] === "\\") {
          body += input.slice(j, j + 2);
          j += 2;
        } else {
          body += input[j] === '"' ? '\\"' : input[j];
          j++;
        }
      }
      out += `"${body}"`;
      fixes.add("single quotes → double quotes");
      i = j + 1;
    } else if (c === "/" && input[i + 1] === "/") {
      while (i < n && input[i] !== "\n") i++;
      fixes.add("removed comments");
    } else if (c === "#") {
      while (i < n && input[i] !== "\n") i++;
      fixes.add("removed comments");
    } else if (c === "/" && input[i + 1] === "*") {
      const end = input.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      fixes.add("removed comments");
    } else if (c === ",") {
      let j = i + 1;
      while (j < n && /\s/.test(input[j])) j++;
      if (input[j] === "}" || input[j] === "]") {
        fixes.add("removed trailing commas");
        i++;
      } else {
        out += c;
        i++;
      }
    } else if (isIdStart(c)) {
      let j = i;
      while (j < n && isId(input[j])) j++;
      const word = input.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(input[k])) k++;
      if (input[k] === ":") {
        out += `"${word}"`;
        fixes.add("quoted property names");
      } else if (word === "True") out += "true", fixes.add("Python literals");
      else if (word === "False") out += "false", fixes.add("Python literals");
      else if (word === "None" || word === "undefined" || word === "NaN") out += "null", fixes.add("None/undefined/NaN → null");
      else out += word;
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return { text: out, fixes: [...fixes] };
}

/** The first array of objects in the document (or the root), as table rows. */
export function toTableRows(value: unknown): { columns: string[]; rows: Record<string, unknown>[] } | null {
  let rows: unknown[] | null = null;
  if (Array.isArray(value)) rows = value;
  else if (value && typeof value === "object") {
    const vals = Object.values(value as Record<string, unknown>);
    if (vals.length > 0 && vals.every((v) => v && typeof v === "object" && !Array.isArray(v))) rows = vals;
  }
  if (!rows || rows.length === 0 || !rows.every((r) => r && typeof r === "object" && !Array.isArray(r))) return null;
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of rows as Record<string, unknown>[]) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    }
  }
  return { columns, rows: rows as Record<string, unknown>[] };
}
