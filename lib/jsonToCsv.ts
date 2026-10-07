export interface JsonToCsvOptions {
  delimiter: string;
  header: boolean;
  quoteAll: boolean;
  /** turn nested objects into dotted columns (a.b); otherwise they are kept as JSON text */
  flatten: boolean;
  /** how arrays inside a row are written: joined with "; " when they hold only simple values, or as JSON text */
  arrays: "join" | "json";
  /** prefix a UTF-8 byte-order mark so Excel opens accents correctly */
  bom: boolean;
  /** prefix a ' to text starting with = + - @ so spreadsheets don't run it as a formula */
  formulaGuard: boolean;
}

export const DEFAULT_CSV_OPTIONS: JsonToCsvOptions = {
  delimiter: ",",
  header: true,
  quoteAll: false,
  flatten: true,
  arrays: "json",
  bom: false,
  formulaGuard: false,
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isSimple = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);

function flatten(obj: unknown, prefix: string, result: Record<string, unknown>, deep: boolean) {
  if (isPlainObject(obj) && Object.keys(obj).length > 0 && (deep || prefix === "")) {
    for (const [key, value] of Object.entries(obj)) flatten(value, prefix ? `${prefix}.${key}` : key, result, deep);
  } else {
    result[prefix] = obj;
  }
  return result;
}

export function jsonToCsv(json: unknown, options: Partial<JsonToCsvOptions> = {}): string {
  const o = { ...DEFAULT_CSV_OPTIONS, ...options };
  const items: unknown[] = Array.isArray(json) ? json : [json];
  const rows: Record<string, unknown>[] = items.map((item) => (isPlainObject(item) ? flatten(item, "", {}, o.flatten) : { value: item }));

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  const cellText = (value: unknown): string => {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return o.arrays === "join" && value.every(isSimple) ? value.map((v) => (v === null ? "" : String(v))).join("; ") : JSON.stringify(value);
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const escape = (value: unknown): string => {
    let text = cellText(value);
    if (o.formulaGuard && typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    const needsQuote = o.quoteAll || text.includes(o.delimiter) || /["\r\n]/.test(text) || /^\s|\s$/.test(text);
    return needsQuote ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = rows.map((row) => columns.map((col) => escape(row[col])).join(o.delimiter));
  if (o.header) lines.unshift(columns.map((c) => escape(c)).join(o.delimiter));
  return (o.bom ? "﻿" : "") + lines.join("\n");
}

export function csvRowCount(json: unknown): number {
  return Array.isArray(json) ? json.length : 1;
}
