import * as XLSX from "xlsx";

import type { Block, Inline } from "@/lib/office/docModel";

export type Cell = string | number | boolean | null;

/** A sheet as plain data: named columns and rows of cell values. */
export interface Grid {
  columns: string[];
  rows: Cell[][];
}

export const SPREADSHEET_ACCEPT = ".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.txt,.json,.html,.htm";

export const DELIMITERS: { id: string; label: string; value: string }[] = [
  { id: "comma", label: "Comma  ,", value: "," },
  { id: "semicolon", label: "Semicolon  ;", value: ";" },
  { id: "tab", label: "Tab", value: "\t" },
  { id: "pipe", label: "Pipe  |", value: "|" },
];

export function cellToString(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell);
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

/** Picks the most likely CSV delimiter by looking for a consistent count outside quoted fields. */
export function detectDelimiter(text: string): string {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 8);
  if (lines.length === 0) return ",";
  let best = ",";
  let bestScore = 0;
  for (const { value } of DELIMITERS) {
    const counts = lines.map((line) => {
      let inQuotes = false;
      let n = 0;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === value && !inQuotes) n++;
      }
      return n;
    });
    const min = Math.min(...counts);
    const consistent = counts.every((c) => c === counts[0]);
    const score = min > 0 ? (consistent ? 2 : 1) * 1000 + min : 0;
    if (score > bestScore) {
      bestScore = score;
      best = value;
    }
  }
  return best;
}

export type SourceKind = "spreadsheet" | "csv" | "json" | "html";

export interface ReadOptions {
  /** CSV/TSV delimiter; auto-detected when omitted. */
  delimiter?: string;
  /** Keep every CSV value as text (preserves leading zeros and long IDs). */
  asText?: boolean;
}

export interface ReadResult {
  workbook: XLSX.WorkBook;
  kind: SourceKind;
  delimiter?: string;
}

function extensionOf(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

function jsonToWorkbook(text: string): XLSX.WorkBook {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This isn't valid JSON.");
  }
  if (!Array.isArray(data)) throw new Error("JSON must be an array of objects or an array of rows.");
  const wb = XLSX.utils.book_new();
  const sheet = data.every((row) => Array.isArray(row))
    ? XLSX.utils.aoa_to_sheet(data as unknown[][])
    : XLSX.utils.json_to_sheet(data.map((row) => (row !== null && typeof row === "object" ? flattenValues(row as Record<string, unknown>) : { value: row })));
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  return wb;
}

/** Nested objects/arrays become JSON text in a single cell so no data is silently dropped. */
function flattenValues(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value !== null && typeof value === "object" ? JSON.stringify(value) : value;
  }
  return out;
}

/** Reads xlsx/xls/ods/csv/tsv/json/html tables from a File. */
export async function readAnyWorkbook(file: File, options: ReadOptions = {}): Promise<ReadResult> {
  const ext = extensionOf(file.name);
  try {
    if (ext === "json") return { workbook: jsonToWorkbook(await file.text()), kind: "json" };

    if (ext === "html" || ext === "htm") {
      const wb = XLSX.read(await file.text(), { type: "string" });
      if (wb.SheetNames.length === 0) throw new Error("No table found in this HTML.");
      return { workbook: wb, kind: "html" };
    }

    if (ext === "csv" || ext === "tsv" || ext === "txt") {
      const text = (await file.text()).replace(/^﻿/, "");
      const delimiter = options.delimiter ?? (ext === "tsv" ? "\t" : detectDelimiter(text));
      const workbook = XLSX.read(text, { type: "string", FS: delimiter, raw: options.asText ?? false });
      return { workbook, kind: "csv", delimiter };
    }

    return { workbook: XLSX.read(await file.arrayBuffer(), { type: "array" }), kind: "spreadsheet" };
  } catch (e) {
    if (e instanceof Error && /JSON|table found/.test(e.message)) throw e;
    throw new Error("Could not read this file as a spreadsheet.");
  }
}

// ---------------------------------------------------------------------------------------------
// Grid conversion
// ---------------------------------------------------------------------------------------------

function uniqueColumnNames(raw: Cell[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((value, index) => {
    const base = cellToString(value).trim() || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

/** Converts a worksheet to a Grid. With `headerRow`, the first row names the columns; otherwise they are "Column N". */
export function sheetToGrid(sheet: XLSX.WorkSheet, headerRow = true): Grid {
  const matrix = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, blankrows: false, raw: true });
  if (matrix.length === 0) return { columns: [], rows: [] };
  const width = Math.max(...matrix.map((row) => row.length));
  const padded = matrix.map((row) => Array.from({ length: width }, (_, i) => (row[i] === undefined ? null : row[i])));
  if (headerRow) return { columns: uniqueColumnNames(padded[0]), rows: padded.slice(1) };
  return { columns: uniqueColumnNames(Array.from({ length: width }, () => null)), rows: padded };
}

export function gridToSheet(grid: Grid, includeHeader = true): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(includeHeader ? [grid.columns, ...grid.rows] : grid.rows);
}

function safeSheetName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = cleaned;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = cleaned.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export interface NamedGrid {
  name: string;
  grid: Grid;
  includeHeader?: boolean;
}

export function gridsToWorkbook(sheets: NamedGrid[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const { name, grid, includeHeader } of sheets) {
    XLSX.utils.book_append_sheet(wb, gridToSheet(grid, includeHeader ?? true), safeSheetName(name, used));
  }
  return wb;
}

// ---------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------

export type ExportFormat = "xlsx" | "xls" | "ods" | "csv" | "tsv" | "json" | "html" | "md";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; extension: string; mime: string }[] = [
  { id: "xlsx", label: "Excel (.xlsx)", extension: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { id: "xls", label: "Excel 97-2003 (.xls)", extension: "xls", mime: "application/vnd.ms-excel" },
  { id: "ods", label: "OpenDocument (.ods)", extension: "ods", mime: "application/vnd.oasis.opendocument.spreadsheet" },
  { id: "csv", label: "CSV (.csv)", extension: "csv", mime: "text/csv" },
  { id: "tsv", label: "TSV (.tsv)", extension: "tsv", mime: "text/tab-separated-values" },
  { id: "json", label: "JSON (.json)", extension: "json", mime: "application/json" },
  { id: "html", label: "HTML table (.html)", extension: "html", mime: "text/html" },
  { id: "md", label: "Markdown table (.md)", extension: "md", mime: "text/markdown" },
];

export interface ExportOptions {
  delimiter?: string;
  includeHeader?: boolean;
  /** Prefix CSV/TSV with a UTF-8 byte-order mark so Excel opens non-English text correctly. */
  bom?: boolean;
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownCell(cell: Cell): string {
  return cellToString(cell).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Serializes one sheet to a text format. */
export function gridToText(grid: Grid, format: "csv" | "tsv" | "json" | "html" | "md", options: ExportOptions = {}): string {
  const includeHeader = options.includeHeader ?? true;
  switch (format) {
    case "csv":
    case "tsv": {
      const delimiter = format === "tsv" ? "\t" : options.delimiter ?? ",";
      const csv = XLSX.utils.sheet_to_csv(gridToSheet(grid, includeHeader), { FS: delimiter });
      return (options.bom ? "﻿" : "") + csv;
    }
    case "json": {
      if (!includeHeader) return JSON.stringify(grid.rows, null, 2);
      return JSON.stringify(
        grid.rows.map((row) => Object.fromEntries(grid.columns.map((name, i) => [name, row[i] ?? null]))),
        null,
        2
      );
    }
    case "html": {
      const head = includeHeader ? `<thead><tr>${grid.columns.map((c) => `<th>${escapeHtmlText(c)}</th>`).join("")}</tr></thead>\n` : "";
      const body = grid.rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtmlText(cellToString(c))}</td>`).join("")}</tr>`).join("\n");
      return `<table>\n${head}<tbody>\n${body}\n</tbody>\n</table>`;
    }
    case "md": {
      const header = `| ${grid.columns.map((c) => markdownCell(c)).join(" | ")} |`;
      const divider = `| ${grid.columns.map(() => "---").join(" | ")} |`;
      const rows = grid.rows.map((row) => `| ${grid.columns.map((_, i) => markdownCell(row[i] ?? null)).join(" | ")} |`);
      return [header, divider, ...rows].join("\n");
    }
  }
}

export function workbookToBytes(wb: XLSX.WorkBook, format: "xlsx" | "xls" | "ods"): Uint8Array {
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: format }));
}

// ---------------------------------------------------------------------------------------------
// Spreadsheet → document blocks (for PDF output)
// ---------------------------------------------------------------------------------------------

const runOf = (text: string): Inline[] => (text === "" ? [] : [{ text }]);

/** Each sheet becomes a heading (when there are several) plus a table; long sheets are capped so the PDF stays usable. */
export function workbookToBlocks(wb: XLSX.WorkBook, sheetNames: string[], maxRows = 3000): { blocks: Block[]; truncated: boolean } {
  const blocks: Block[] = [];
  let truncated = false;
  for (const name of sheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const grid = sheetToGrid(sheet, true);
    if (grid.columns.length === 0) continue;
    if (sheetNames.length > 1) blocks.push({ type: "heading", level: 2, runs: [{ text: name }] });
    const rows = grid.rows.slice(0, maxRows);
    if (grid.rows.length > maxRows) truncated = true;
    blocks.push({
      type: "table",
      header: grid.columns.map((c) => runOf(c)),
      rows: rows.map((row) => grid.columns.map((_, i) => runOf(cellToString(row[i] ?? null)))),
    });
  }
  return { blocks, truncated };
}
