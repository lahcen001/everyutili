"use client";

import * as React from "react";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { exportSheets } from "@/lib/office/exportSheets";
import {
  DELIMITERS,
  EXPORT_FORMATS,
  SPREADSHEET_ACCEPT,
  cellToString,
  readAnyWorkbook,
  sheetToGrid,
  type ExportFormat,
  type NamedGrid,
  type ReadResult,
} from "@/lib/office/sheets";
import { formatBytes } from "@/lib/format";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

interface Source extends ReadResult {
  id: string;
  file: File;
}

const stemOf = (name: string) => name.replace(/\.[^.]+$/, "");

export default function SpreadsheetConverter() {
  useTrackTool("spreadsheet-converter");
  const [files, setFiles] = React.useState<File[]>([]);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [delimiterChoice, setDelimiterChoice] = React.useState("auto");
  const [asText, setAsText] = React.useState(false);
  const [headerRow, setHeaderRow] = React.useState(true);
  const [format, setFormat] = React.useState<ExportFormat>("xlsx");
  const [outDelimiter, setOutDelimiter] = React.useState(",");
  const [bom, setBom] = React.useState(false);
  const [isReading, setIsReading] = React.useState(false);
  const [isConverting, setIsConverting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  React.useEffect(() => {
    if (files.length === 0) return;
    let cancelled = false;
    (async () => {
      setIsReading(true);
      try {
        const read = await Promise.all(
          files.map(async (file, i) => ({
            id: `${i}:${file.name}:${file.size}`,
            file,
            ...(await readAnyWorkbook(file, { delimiter: delimiterChoice === "auto" ? undefined : delimiterChoice, asText })),
          }))
        );
        if (cancelled) return;
        setSources(read);
        setSelected(new Set(read.flatMap((s) => s.workbook.SheetNames.map((n) => `${s.id}|${n}`))));
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not read these files.");
      } finally {
        if (!cancelled) setIsReading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, delimiterChoice, asText]);

  const addFiles = (incoming: File[]) => setFiles((prev) => [...prev, ...incoming]);
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setSources([]);
      setSelected(new Set());
    }
  };

  const namedGrids = (): NamedGrid[] => {
    const multi = sources.length > 1;
    const result: NamedGrid[] = [];
    for (const source of sources) {
      for (const sheetName of source.workbook.SheetNames) {
        if (!selected.has(`${source.id}|${sheetName}`)) continue;
        const onlySheet = source.workbook.SheetNames.length === 1;
        const name = onlySheet && source.kind !== "spreadsheet" ? stemOf(source.file.name) : multi ? `${stemOf(source.file.name)} - ${sheetName}` : sheetName;
        result.push({ name, grid: sheetToGrid(source.workbook.Sheets[sheetName], headerRow), includeHeader: headerRow });
      }
    }
    return result;
  };

  const previewGrid = (() => {
    for (const source of sources) {
      for (const sheetName of source.workbook.SheetNames) {
        if (selected.has(`${source.id}|${sheetName}`)) return sheetToGrid(source.workbook.Sheets[sheetName], headerRow);
      }
    }
    return null;
  })();

  const convert = async () => {
    setIsConverting(true);
    setError(null);
    try {
      const out = await exportSheets(namedGrids(), format, sources.length === 1 ? stemOf(sources[0].file.name) : "converted", {
        delimiter: outDelimiter,
        includeHeader: headerRow,
        bom,
      });
      downloadBlob(out.blob, out.fileName);
      await saveToolResult("spreadsheet-converter", {
        title: out.fileName,
        summary: `${out.sheetCount} sheet${out.sheetCount === 1 ? "" : "s"} → ${format.toUpperCase()} · ${formatBytes(out.blob.size)}`,
        blob: out.blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setIsConverting(false);
    }
  };

  const toggleSheet = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const hasCsv = sources.some((s) => s.kind === "csv");
  const isTextFormat = !["xlsx", "xls", "ods"].includes(format);

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={addFiles}
        accept={SPREADSHEET_ACCEPT}
        label="Drag & drop spreadsheets here, or click to browse"
        hint="Excel, OpenDocument, CSV, TSV, JSON or an HTML table — add several files to combine them"
      />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="grid gap-2">
          {files.map((file, i) => (
            <Card key={`${file.name}-${i}`} className="flex items-center gap-3 p-3">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <button onClick={() => removeFile(i)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${file.name}`}>
                <X className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {isReading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading…
        </div>
      )}

      {sources.length > 0 && (
        <>
          <Card className="space-y-4 p-4">
            <p className="text-sm font-medium">Input options</p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} className="h-4 w-4 rounded border-border" />
                First row is a header
              </label>
              {hasCsv && (
                <>
                  <label className="flex items-center gap-2">
                    Delimiter
                    <select value={delimiterChoice} onChange={(e) => setDelimiterChoice(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                      <option value="auto">Auto-detect</option>
                      {DELIMITERS.map((d) => (
                        <option key={d.id} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={asText} onChange={(e) => setAsText(e.target.checked)} className="h-4 w-4 rounded border-border" />
                    Keep CSV values as text (preserves leading zeros)
                  </label>
                </>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Sheets to convert</p>
              {sources.map((source) => (
                <div key={source.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">{source.file.name}</span>
                  {source.workbook.SheetNames.map((name) => (
                    <label key={name} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={selected.has(`${source.id}|${name}`)} onChange={() => toggleSheet(`${source.id}|${name}`)} className="h-4 w-4 rounded border-border" />
                      {name}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          {previewGrid && (
            <Card className="space-y-2 p-4">
              <p className="text-sm font-medium">
                Preview <span className="font-normal text-muted-foreground">— {previewGrid.rows.length.toLocaleString()} rows × {previewGrid.columns.length} columns</span>
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/70">
                    <tr>
                      {previewGrid.columns.slice(0, 12).map((c, i) => (
                        <th key={i} className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewGrid.rows.slice(0, 8).map((row, r) => (
                      <tr key={r} className="border-b border-border last:border-0">
                        {previewGrid.columns.slice(0, 12).map((_, c) => (
                          <td key={c} className="max-w-[16rem] truncate px-2 py-1">
                            {cellToString(row[c] ?? null)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="space-y-4 p-4">
            <p className="text-sm font-medium">Convert to</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Output format">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={format === f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    format === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {(format === "csv" || format === "tsv") && (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {format === "csv" && (
                  <label className="flex items-center gap-2">
                    Delimiter
                    <select value={outDelimiter} onChange={(e) => setOutDelimiter(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                      {DELIMITERS.map((d) => (
                        <option key={d.id} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} className="h-4 w-4 rounded border-border" />
                  Add UTF-8 BOM (helps Excel show accents and non-Latin text)
                </label>
              </div>
            )}
            {isTextFormat && selected.size > 1 && <p className="text-xs text-muted-foreground">Several sheets are downloaded together as a .zip.</p>}
            <Button onClick={convert} disabled={isConverting || selected.size === 0}>
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Converting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Convert & Download
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="spreadsheet-converter" />
    </div>
  );
}
