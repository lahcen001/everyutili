import JSZip from "jszip";

import { EXPORT_FORMATS, gridsToWorkbook, gridToText, workbookToBytes, type ExportFormat, type ExportOptions, type NamedGrid } from "@/lib/office/sheets";

export interface ExportedFile {
  blob: Blob;
  fileName: string;
  /** Number of sheets written. */
  sheetCount: number;
}

function safeFileStem(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "sheet";
}

/**
 * Writes sheets in the chosen format. Workbook formats (xlsx/xls/ods) always produce one file with every
 * sheet; text formats produce one file for a single sheet, or a zip with one file per sheet.
 */
export async function exportSheets(sheets: NamedGrid[], format: ExportFormat, baseName: string, options: ExportOptions = {}): Promise<ExportedFile> {
  const meta = EXPORT_FORMATS.find((f) => f.id === format);
  if (!meta) throw new Error("Unknown export format.");
  if (sheets.length === 0) throw new Error("Select at least one sheet to export.");
  const stem = safeFileStem(baseName);

  if (format === "xlsx" || format === "xls" || format === "ods") {
    const wb = gridsToWorkbook(sheets.map((s) => ({ ...s, includeHeader: options.includeHeader ?? true })));
    const bytes = workbookToBytes(wb, format);
    return { blob: new Blob([bytes as BlobPart], { type: meta.mime }), fileName: `${stem}.${meta.extension}`, sheetCount: sheets.length };
  }

  if (sheets.length === 1) {
    const text = gridToText(sheets[0].grid, format, options);
    return { blob: new Blob([text], { type: `${meta.mime};charset=utf-8` }), fileName: `${stem}.${meta.extension}`, sheetCount: 1 };
  }

  const zip = new JSZip();
  const used = new Set<string>();
  for (const sheet of sheets) {
    let name = safeFileStem(sheet.name);
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${safeFileStem(sheet.name)} (${n++})`;
    used.add(name.toLowerCase());
    zip.file(`${name}.${meta.extension}`, gridToText(sheet.grid, format, options));
  }
  return { blob: await zip.generateAsync({ type: "blob" }), fileName: `${stem}.zip`, sheetCount: sheets.length };
}
