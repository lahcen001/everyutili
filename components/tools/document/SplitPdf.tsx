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

export default function SplitPdf() {
  useTrackTool("split-pdf");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [mode, setMode] = React.useState<"all" | "range">("all");
  const [gridState, setGridState] = React.useState<VisualPdfPageGridState | null>(null);
  const [isSplitting, setIsSplitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const gridRef = React.useRef<VisualPdfPageGridHandle>(null);

  const handleFiles = async (files: File[]) => {
    const pdfFile = files.find((f) => f.type === "application/pdf");
    if (!pdfFile) return;
    setError(null);
    try {
      const bytes = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      setFile(pdfFile);
      setPageCount(pdf.getPageCount());
      setGridState(null);
    } catch {
      setError("Could not read this PDF file. It may be corrupted or password-protected.");
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

  const splitPdf = async () => {
    if (!file) return;
    setIsSplitting(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(bytes);
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
            page.setRotation(degrees((page.getRotation().angle + rotationDeg) % 360));
          }
          outPdf.addPage(page);
        });
        const outBytes = await outPdf.save();
        const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
        const outName = `${baseName}-pages-${targetPages[0]}-${targetPages[targetPages.length - 1]}.pdf`;
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
      setError(e instanceof Error ? e.message : "Failed to split PDF.");
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
        hint="Split into individual pages or extract a custom page range"
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            <div className="flex overflow-hidden rounded-lg border border-border w-fit">
              <button
                onClick={() => setMode("all")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                Split into all pages
              </button>
              <button
                onClick={() => setMode("range")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "range" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                Extract page range
              </button>
            </div>

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
              disabled={isSplitting || (mode === "range" && selectedPages.length === 0)}
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
