"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Eraser, Loader2, Merge, Trash2, Undo2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { exportSheets } from "@/lib/office/exportSheets";
import {
  dedupeRows,
  matchingRowIndices,
  mergeAppend,
  moveColumn,
  removeColumns,
  removeEmptyRows,
  renameColumn,
  sortRows,
  trimCells,
} from "@/lib/office/sheetOps";
import { EXPORT_FORMATS, SPREADSHEET_ACCEPT, cellToString, readAnyWorkbook, sheetToGrid, type Cell, type ExportFormat, type Grid, type NamedGrid } from "@/lib/office/sheets";
import { formatBytes } from "@/lib/format";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 34;
const COL_WIDTH = 168;
const CHECK_WIDTH = 44;

function coerce(value: string, previous: Cell): Cell {
  if (value === "") return null;
  if (typeof previous === "number" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

export default function SpreadsheetStudio() {
  useTrackTool("spreadsheet-studio");
  const [sheets, setSheets] = React.useState<NamedGrid[]>([]);
  const [active, setActive] = React.useState(0);
  const [history, setHistory] = React.useState<NamedGrid[][]>([]);
  const [query, setQuery] = React.useState("");
  const [queryCol, setQueryCol] = React.useState<number | null>(null);
  const [selectedRows, setSelectedRows] = React.useState<Set<number>>(new Set());
  const [editing, setEditing] = React.useState<{ row: number; col: number } | null>(null);
  const [sortState, setSortState] = React.useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const [dupCols, setDupCols] = React.useState<Set<number>>(new Set());
  const [dupIgnoreCase, setDupIgnoreCase] = React.useState(true);
  const [dupTrim, setDupTrim] = React.useState(true);
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("xlsx");
  const [exportScope, setExportScope] = React.useState<"sheet" | "all">("all");
  const [baseName, setBaseName] = React.useState("spreadsheet");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const sheet = sheets[active] as NamedGrid | undefined;
  const grid: Grid = sheet?.grid ?? { columns: [], rows: [] };
  const visible = matchingRowIndices(grid, query, queryCol);

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const commit = (next: Grid, message: string | null = null) => {
    setHistory((h) => [...h.slice(-19), sheets]);
    setSheets((prev) => prev.map((s, i) => (i === active ? { ...s, grid: next } : s)));
    setSelectedRows(new Set());
    setNotice(message);
  };

  const commitSheets = (next: NamedGrid[], nextActive: number, message: string | null = null) => {
    setHistory((h) => [...h.slice(-19), sheets]);
    setSheets(next);
    setActive(nextActive);
    setSelectedRows(new Set());
    setEditing(null);
    setNotice(message);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setSheets(previous);
    setActive((a) => Math.min(a, previous.length - 1));
    setSelectedRows(new Set());
    setNotice("Undid the last change.");
  };

  const loadFiles = async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const added: NamedGrid[] = [];
      for (const file of files) {
        const { workbook } = await readAnyWorkbook(file);
        const stem = file.name.replace(/\.[^.]+$/, "");
        for (const name of workbook.SheetNames) {
          const multi = files.length > 1 || sheets.length > 0;
          added.push({ name: workbook.SheetNames.length === 1 ? stem : multi ? `${stem} - ${name}` : name, grid: sheetToGrid(workbook.Sheets[name], true) });
        }
        if (sheets.length === 0 && added.length > 0 && baseName === "spreadsheet") setBaseName(stem);
      }
      commitSheets([...sheets, ...added], sheets.length, `Loaded ${added.length} sheet${added.length === 1 ? "" : "s"}.`);
      setHistory([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read these files.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSort = (col: number) => {
    const dir = sortState?.col === col && sortState.dir === "asc" ? "desc" : "asc";
    setSortState({ col, dir });
    commit(sortRows(grid, col, dir), `Sorted by “${grid.columns[col]}” (${dir === "asc" ? "A→Z" : "Z→A"}).`);
  };

  const commitCellEdit = (row: number, col: number, value: string) => {
    setEditing(null);
    const previous = grid.rows[row]?.[col] ?? null;
    const next = coerce(value, previous);
    if (next === previous) return;
    const rows = grid.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? next : c)) : r));
    commit({ columns: grid.columns, rows });
  };

  const runDedupe = () => {
    const result = dedupeRows(grid, { columns: [...dupCols], ignoreCase: dupIgnoreCase, trim: dupTrim });
    commit(result.grid, result.removed === 0 ? "No duplicate rows found." : `Removed ${result.removed.toLocaleString()} duplicate row${result.removed === 1 ? "" : "s"}.`);
  };

  const runExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const chosen = exportScope === "sheet" && sheet ? [sheet] : sheets;
      const out = await exportSheets(chosen, exportFormat, baseName.trim() || "spreadsheet");
      downloadBlob(out.blob, out.fileName);
      await saveToolResult("spreadsheet-studio", {
        title: out.fileName,
        summary: `${out.sheetCount} sheet${out.sheetCount === 1 ? "" : "s"} · ${formatBytes(out.blob.size)}`,
        blob: out.blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const allVisibleSelected = visible.length > 0 && visible.every((i) => selectedRows.has(i));
  const tableWidth = CHECK_WIDTH + grid.columns.length * COL_WIDTH;

  return (
    <div className="space-y-6">
      {sheets.length === 0 ? (
        <DropZone
          onFiles={loadFiles}
          accept={SPREADSHEET_ACCEPT}
          label="Drag & drop spreadsheets here, or click to browse"
          hint="Open Excel, ODS, CSV, TSV or JSON files to view, clean, merge and edit them"
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Add more files
            <input
              type="file"
              multiple
              accept={SPREADSHEET_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length) loadFiles(picked);
                e.target.value = "";
              }}
            />
          </label>
          <Button size="sm" variant="ghost" onClick={() => commitSheets([], 0)}>
            <X className="h-3.5 w-3.5" /> Close all
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading…
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          {notice}
        </div>
      )}

      {sheet && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {sheets.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setActive(i);
                  setEditing(null);
                  setSelectedRows(new Set());
                  setQueryCol(null);
                }}
                aria-pressed={i === active}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", i === active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
              >
                {s.name}
              </button>
            ))}
            {sheets.length > 1 && (
              <>
                <Button size="sm" variant="outline" onClick={() => commitSheets([{ name: "Merged", grid: mergeAppend(sheets.map((s) => s.grid)) }], 0, "Merged all sheets into one (columns matched by name).")}>
                  <Merge className="h-3.5 w-3.5" /> Merge all into one sheet
                </Button>
                <Button size="sm" variant="outline" onClick={() => commitSheets(sheets.filter((_, i) => i !== active), Math.max(0, active - 1), `Removed sheet “${sheet.name}”.`)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete this sheet
                </Button>
              </>
            )}
          </div>

          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rows…"
                aria-label="Search rows"
                className="h-9 min-w-[10rem] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={queryCol === null ? "" : String(queryCol)}
                onChange={(e) => setQueryCol(e.target.value === "" ? null : Number(e.target.value))}
                aria-label="Search in column"
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="">All columns</option>
                {grid.columns.map((c, i) => (
                  <option key={i} value={i}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {visible.length.toLocaleString()} of {grid.rows.length.toLocaleString()} rows · {grid.columns.length} columns
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={undo} disabled={history.length === 0}>
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
              <Button size="sm" variant="outline" onClick={() => { const r = removeEmptyRows(grid); commit(r.grid, r.removed ? `Removed ${r.removed} empty row${r.removed === 1 ? "" : "s"}.` : "No empty rows found."); }}>
                <Eraser className="h-3.5 w-3.5" /> Remove empty rows
              </Button>
              <Button size="sm" variant="outline" onClick={() => commit(trimCells(grid), "Trimmed leading and trailing spaces.")}>
                Trim spaces
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedRows.size === 0}
                onClick={() => commit({ columns: grid.columns, rows: grid.rows.filter((_, i) => !selectedRows.has(i)) }, `Deleted ${selectedRows.size} row${selectedRows.size === 1 ? "" : "s"}.`)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete selected rows ({selectedRows.size})
              </Button>
            </div>

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Remove duplicate rows</summary>
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Rows are duplicates when the ticked columns match. Leave all unticked to compare every column. The first copy is kept.</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {grid.columns.map((c, i) => (
                    <label key={i} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={dupCols.has(i)}
                        onChange={() => setDupCols((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                        className="h-4 w-4 rounded border-border"
                      />
                      {c}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={dupIgnoreCase} onChange={(e) => setDupIgnoreCase(e.target.checked)} className="h-4 w-4 rounded border-border" /> Ignore upper/lower case
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={dupTrim} onChange={(e) => setDupTrim(e.target.checked)} className="h-4 w-4 rounded border-border" /> Ignore extra spaces
                  </label>
                  <Button size="sm" onClick={runDedupe}>
                    Remove duplicates
                  </Button>
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Columns — rename, reorder, delete</summary>
              <div className="mt-3 space-y-2">
                {grid.columns.map((c, i) => (
                  <div key={`${i}-${c}`} className="flex items-center gap-2">
                    <input
                      defaultValue={c}
                      aria-label={`Column ${i + 1} name`}
                      onBlur={(e) => e.target.value !== c && commit(renameColumn(grid, i, e.target.value.trim() || c))}
                      className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={i === 0} onClick={() => commit(moveColumn(grid, i, i - 1))} aria-label={`Move ${c} left`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={i === grid.columns.length - 1} onClick={() => commit(moveColumn(grid, i, i + 1))} aria-label={`Move ${c} right`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={grid.columns.length <= 1} onClick={() => commit(removeColumns(grid, [i]), `Deleted column “${c}”.`)} aria-label={`Delete column ${c}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          </Card>

          <div ref={scrollRef} className="max-h-[520px] overflow-auto rounded-lg border border-border bg-background">
            <div style={{ width: tableWidth, minWidth: "100%" }}>
              <div className="sticky top-0 z-10 flex border-b border-border bg-muted/80 text-xs font-medium backdrop-blur" style={{ height: ROW_HEIGHT }}>
                <div className="flex shrink-0 items-center justify-center" style={{ width: CHECK_WIDTH }}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible rows"
                    checked={allVisibleSelected}
                    onChange={(e) => setSelectedRows(e.target.checked ? new Set(visible) : new Set())}
                    className="h-4 w-4 rounded border-border"
                  />
                </div>
                {grid.columns.map((c, i) => (
                  <button key={i} onClick={() => toggleSort(i)} className="flex shrink-0 items-center gap-1 truncate px-2 text-left hover:bg-muted" style={{ width: COL_WIDTH }} title="Click to sort">
                    <span className="truncate">{c}</span>
                    {sortState?.col === i ? sortState.dir === "asc" ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" /> : <ArrowUpDown className="h-3 w-3 shrink-0 opacity-30" />}
                  </button>
                ))}
              </div>
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const rowIndex = visible[item.index];
                  const row = grid.rows[rowIndex];
                  return (
                    <div
                      key={rowIndex}
                      className={cn("absolute left-0 flex w-full items-center border-b border-border text-sm", selectedRows.has(rowIndex) && "bg-primary/10")}
                      style={{ top: 0, height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                    >
                      <div className="flex shrink-0 items-center justify-center" style={{ width: CHECK_WIDTH }}>
                        <input
                          type="checkbox"
                          aria-label={`Select row ${rowIndex + 1}`}
                          checked={selectedRows.has(rowIndex)}
                          onChange={() => setSelectedRows((prev) => { const n = new Set(prev); if (n.has(rowIndex)) n.delete(rowIndex); else n.add(rowIndex); return n; })}
                          className="h-4 w-4 rounded border-border"
                        />
                      </div>
                      {grid.columns.map((_, col) => {
                        const isEditing = editing?.row === rowIndex && editing.col === col;
                        return (
                          <div key={col} className="shrink-0 truncate px-2" style={{ width: COL_WIDTH }} onDoubleClick={() => setEditing({ row: rowIndex, col })} title="Double-click to edit">
                            {isEditing ? (
                              <input
                                autoFocus
                                defaultValue={cellToString(row[col] ?? null)}
                                onBlur={(e) => commitCellEdit(rowIndex, col, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                className="h-7 w-full rounded border border-primary bg-background px-1 text-sm outline-none"
                              />
                            ) : (
                              cellToString(row[col] ?? null)
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            {visible.length === 0 && <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">{grid.rows.length === 0 ? "This sheet is empty." : "No rows match your search."}</div>}
          </div>
          <p className="text-xs text-muted-foreground">Double-click a cell to edit it. Click a column header to sort. Changes stay in your browser until you export.</p>

          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium">Export</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                Format
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                  {EXPORT_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              {sheets.length > 1 && (
                <label className="flex items-center gap-2">
                  Sheets
                  <select value={exportScope} onChange={(e) => setExportScope(e.target.value as "sheet" | "all")} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                    <option value="all">All sheets</option>
                    <option value="sheet">Only “{sheet.name}”</option>
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2">
                File name
                <input value={baseName} onChange={(e) => setBaseName(e.target.value)} className="h-9 w-44 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <Button onClick={runExport} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
              </Button>
            </div>
            {!["xlsx", "xls", "ods"].includes(exportFormat) && exportScope === "all" && sheets.length > 1 && <p className="text-xs text-muted-foreground">Several sheets are downloaded together as a .zip, one file per sheet.</p>}
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="spreadsheet-studio" />
    </div>
  );
}
