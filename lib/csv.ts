import Papa from "papaparse";

export interface CsvOptions {
  /** "auto" detects , ; tab | */
  delimiter: "auto" | "," | ";" | "\t" | "|";
  header: boolean;
  trim: boolean;
  /** turn 12 into a number, true/false into booleans */
  inferTypes: boolean;
  /** write empty cells as null instead of "" */
  emptyAsNull: boolean;
}

export const DEFAULT_CSV_PARSE: CsvOptions = { delimiter: "auto", header: true, trim: false, inferTypes: true, emptyAsNull: false };

export interface CsvParsed {
  columns: string[];
  rows: unknown[][];
  delimiter: string;
  warnings: string[];
}

export type CsvResult = { ok: true; data: CsvParsed } | { ok: false; message: string };

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export function inferValue(text: string, emptyAsNull: boolean): unknown {
  if (text === "") return emptyAsNull ? null : "";
  if (NUMBER.test(text)) {
    // numbers with more than 15 significant digits would lose precision, so they stay text
    const mantissa = text.split(/[eE]/)[0].replace(/[-.]/g, "").replace(/^0+/, "");
    return mantissa.length <= 15 ? Number(text) : text;
  }
  const lower = text.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  return text;
}

export function parseCsv(input: string, options: Partial<CsvOptions> = {}): CsvResult {
  const o = { ...DEFAULT_CSV_PARSE, ...options };
  const text = input.replace(/^﻿/, "");
  if (text.trim() === "") return { ok: false, message: "Empty input" };

  const result = Papa.parse<string[]>(text, { delimiter: o.delimiter === "auto" ? "" : o.delimiter, skipEmptyLines: "greedy", header: false });
  const fatal = result.errors.find((e) => e.type === "Quotes" || e.type === "Delimiter");
  const warnings: string[] = [];
  if (fatal && fatal.type === "Quotes") return { ok: false, message: `Quoted field problem near row ${(fatal.row ?? 0) + 1}: ${fatal.message}` };

  let data = result.data as string[][];
  if (data.length === 0) return { ok: false, message: "No rows found" };
  if (o.trim) data = data.map((r) => r.map((c) => c.trim()));

  let columns: string[];
  let body: string[][];
  if (o.header) {
    const rawHeader = data[0].map((h, i) => (h === "" ? `column_${i + 1}` : h));
    const used = new Map<string, number>();
    columns = rawHeader.map((h) => {
      const count = (used.get(h) ?? 0) + 1;
      used.set(h, count);
      if (count > 1) {
        warnings.push(`Duplicate column "${h}" renamed to "${h}_${count}"`);
        return `${h}_${count}`;
      }
      return h;
    });
    body = data.slice(1);
  } else {
    const width = Math.max(...data.map((r) => r.length));
    columns = Array.from({ length: width }, (_, i) => `column_${i + 1}`);
    body = data;
  }

  const ragged = body.filter((r) => r.length !== columns.length).length;
  if (ragged > 0) warnings.push(`${ragged} row${ragged === 1 ? " has" : "s have"} a different number of fields than the header — missing cells are left empty.`);

  const rows = body.map((r) => columns.map((_, i) => (i < r.length ? (o.inferTypes ? inferValue(r[i], o.emptyAsNull) : r[i] === "" && o.emptyAsNull ? null : r[i]) : o.emptyAsNull ? null : "")));
  return { ok: true, data: { columns, rows, delimiter: result.meta.delimiter, warnings } };
}

export function csvToJsonText(input: string, options: Partial<CsvOptions> & { indent?: number | "tab"; asObjects?: boolean } = {}): { ok: true; text: string; parsed: CsvParsed } | { ok: false; message: string } {
  const r = parseCsv(input, options);
  if (!r.ok) return r;
  const asObjects = options.asObjects ?? true;
  const value = asObjects ? r.data.rows.map((row) => Object.fromEntries(r.data.columns.map((c, i) => [c, row[i]]))) : [r.data.columns, ...r.data.rows];
  const indent = options.indent ?? 2;
  return { ok: true, text: JSON.stringify(value, null, indent === "tab" ? "\t" : indent), parsed: r.data };
}

export function delimiterName(d: string): string {
  return d === "," ? "comma" : d === ";" ? "semicolon" : d === "\t" ? "tab" : d === "|" ? "pipe" : JSON.stringify(d);
}
