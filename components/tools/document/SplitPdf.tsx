"use client";

import * as React from "react";
import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";
import { Loader2, Scissors, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import {
  VisualPdfPageGrid,
  type VisualPdfPageGridHandle,
  type VisualPdfPageGridState,
} from "@/components/tools/document/VisualPdfPageGrid";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { addRotation } from "@/lib/pdf/rotation";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { chunkPages, describePages, parsePageRangeGroups } from "@/lib/pdf/ranges";
import { cn } from "@/lib/utils";

type SplitMode = "all" | "range" | "ranges" | "every";

const MODES: { id: SplitMode; label: string }[] = [
  { id: "all", label: "Every page" },
  { id: "ranges", label: "Page ranges" },
  { id: "every", label: "Every N pages" },
  { id: "range", label: "Pick pages visually" },
];

export default function SplitPdf() {
  useTrackTool("split-pdf");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [mode, setMode] = React.useState<SplitMode>("all");
  const [rangeText, setRangeText] = React.useState("");
  const [separateFiles, setSeparateFiles] = React.useState(true);
  const [everyN, setEveryN] = React.useState(2);
  const [gridState, setGridState] = React.useState<VisualPdfPageGridState | null>(null);
  const [isSplitting, setIsSplitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const gridRef = React.useRef<VisualPdfPageGridHandle>(null);

  const handleFiles = async (files: File[]) => {
    const pdfFile = files.find((f) => isPdfFile(f));
    if (!pdfFile) return;
    setError(null);
    try {
      const bytes = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      setFile(pdfFile);
      setPageCount(pdf.getPageCount());
      setGridState(null);
    } catch (e) {
      setError(friendlyPdfError(e, "Could not read this PDF file. It may be corrupted."));
    }
  };

  const removeFile = () => {
    setFile(null);
    setPageCount(0);
    setGridState(null);
    setError(null);
  };

  const selectedPages = React.useMemo(() => {
    if (!gridState) return [];
    return gridState.order.filter((pageNumber) => gridState.selected.has(pageNumber));
  }, [gridState]);

  const typedPlan = (() => {
    if (mode === "ranges") {
      const parsed = parsePageRangeGroups(rangeText, pageCount);
      if (parsed.error) return { groups: [] as number[][], error: rangeText.trim() === "" ? undefined : parsed.error };
      const groups = separateFiles ? parsed.groups : [[...new Set(parsed.groups.flat())].sort((a, b) => a - b)];
      return { groups, error: undefined };
    }
    if (mode === "every") {
      if (!Number.isInteger(everyN) || everyN < 1) return { groups: [] as number[][], error: "Enter a whole number of pages, 1 or more." };
      return { groups: chunkPages(pageCount, everyN), error: undefined };
    }
    return { groups: [] as number[][], error: undefined };
  })();

  const saveGroups = async (srcPdf: PDFDocument, groups: number[][], baseName: string) => {
    const build = async (pages: number[]) => {
      const out = await PDFDocument.create();
      const copied = await out.copyPages(srcPdf, pages.map((p) => p - 1));
      copied.forEach((page) => out.addPage(page));
      return out.save();
    };
    if (groups.length === 1) {
      const blob = new Blob([new Uint8Array(await build(groups[0]))], { type: "application/pdf" });
      const outName = `${baseName}-pages-${describePages(groups[0])}.pdf`;
      downloadBlob(blob, outName);
      await saveToolResult("split-pdf", { title: outName, summary: `${groups[0].length} page${groups[0].length === 1 ? "" : "s"} extracted · ${formatBytes(blob.size)}`, blob });
    } else {
      const zip = new JSZip();
      const used = new Set<string>();
      for (const pages of groups) {
        let name = `${baseName}-pages-${describePages(pages)}`;
        let n = 2;
        while (used.has(name)) name = `${baseName}-pages-${describePages(pages)} (${n++})`;
        used.add(name);
        zip.file(`${name}.pdf`, await build(pages));
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const outName = `${baseName}-split.zip`;
      downloadBlob(zipBlob, outName);
      await saveToolResult("split-pdf", { title: outName, summary: `${groups.length} files · ${formatBytes(zipBlob.size)}`, blob: zipBlob });
    }
    historyRef.current?.refresh();
  };

  const splitPdf = async () => {
    if (!file) return;
    setIsSplitting(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(bytes);
      if (mode === "ranges" || mode === "every") {
        if (typedPlan.groups.length === 0) {
          setError(typedPlan.error ?? "Enter the pages to extract, for example 1-3, 5, 8-.");
          return;
        }
        await saveGroups(srcPdf, typedPlan.groups, file.name.replace(/\.pdf$/i, ""));
        return;
      }
      const state = mode === "range" ? gridRef.current?.getState() ?? gridState : null;
      const targetPages =
        mode === "all"
          ? Array.from({ length: pageCount }, (_, i) => i + 1)
          : state
            ? state.order.filter((pageNumber) => state.selected.has(pageNumber))
            : [];

      if (targetPages.length === 0) {
        setError("No valid pages selected to split.");
        setIsSplitting(false);
        return;
      }

      const baseName = file.name.replace(/\.pdf$/i, "");

      if (mode === "range") {
        const outPdf = await PDFDocument.create();
        const pages = await outPdf.copyPages(
          srcPdf,
          targetPages.map((p) => p - 1)
        );
        pages.forEach((page, i) => {
          const rotationDeg = state?.rotations[targetPages[i]] ?? 0;
          if (rotationDeg !== 0) {
            page.setRotation(degrees(addRotation(page.getRotation().angle, rotationDeg)));
          }
          outPdf.addPage(page);
        });
        const outBytes = await outPdf.save();
        const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
        const outName = `${baseName}-pages-${describePages([...targetPages].sort((a, b) => a - b))}.pdf`;
        downloadBlob(blob, outName);

        await saveToolResult("split-pdf", {
          title: outName,
          summary: `${targetPages.length} page${targetPages.length === 1 ? "" : "s"} extracted · ${formatBytes(blob.size)}`,
          blob,
        });
        historyRef.current?.refresh();
      } else {
        const zip = new JSZip();
        for (const pageNum of targetPages) {
          const outPdf = await PDFDocument.create();
          const [page] = await outPdf.copyPages(srcPdf, [pageNum - 1]);
          outPdf.addPage(page);
          const outBytes = await outPdf.save();
          zip.file(`${baseName}-page-${pageNum}.pdf`, outBytes);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const outName = `${baseName}-split.zip`;
        downloadBlob(zipBlob, outName);

        await saveToolResult("split-pdf", {
          title: outName,
          summary: `${targetPages.length} page${targetPages.length === 1 ? "" : "s"} split · ${formatBytes(zipBlob.size)}`,
          blob: zipBlob,
        });
        historyRef.current?.refresh();
      }
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to split PDF."));
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Split into single pages, typed ranges, every N pages, or pick pages visually"
      />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && (
        <>
          <Card className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · {pageCount} pages
              </p>
            </div>
            <button
              onClick={removeFile}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap overflow-hidden rounded-lg border border-border w-fit" role="group" aria-label="Split method">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  aria-pressed={mode === m.id}
                  className={cn("px-3 py-1.5 text-sm font-medium transition-colors", mode === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === "ranges" && (
              <div className="space-y-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Pages to extract</span>
                  <input
                    value={rangeText}
                    onChange={(e) => setRangeText(e.target.value)}
                    placeholder="e.g. 1-3, 5, 8-"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={separateFiles} onChange={(e) => setSeparateFiles(e.target.checked)} className="h-4 w-4 rounded border-border" />
                  Make a separate PDF for each range
                </label>
                <p className={cn("text-xs", typedPlan.error ? "text-destructive" : "text-muted-foreground")}>
                  {typedPlan.error ?? (typedPlan.groups.length > 0 ? `${typedPlan.groups.length} file${typedPlan.groups.length === 1 ? "" : "s"} — "8-" means page 8 to the end.` : `This PDF has ${pageCount} pages. "8-" means page 8 to the end.`)}
                </p>
              </div>
            )}

            {mode === "every" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Pages per file</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, pageCount)}
                    value={everyN}
                    onChange={(e) => setEveryN(Math.floor(Number(e.target.value)))}
                    className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <p className={cn("text-xs", typedPlan.error ? "text-destructive" : "text-muted-foreground")}>
                  {typedPlan.error ?? `${typedPlan.groups.length} file${typedPlan.groups.length === 1 ? "" : "s"} from ${pageCount} pages.`}
                </p>
              </div>
            )}

            {mode === "range" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Select pages to extract</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedPages.length} page{selectedPages.length === 1 ? "" : "s"} selected
                  </span>
                </div>
                <VisualPdfPageGrid ref={gridRef} file={file} onChange={setGridState} />
              </div>
            )}

            <Button
              onClick={splitPdf}
              disabled={isSplitting || (mode === "range" && selectedPages.length === 0) || ((mode === "ranges" || mode === "every") && typedPlan.groups.length === 0)}
            >
              {isSplitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Splitting…
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4" /> Split & Download
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="split-pdf" />
    </div>
  );
}
