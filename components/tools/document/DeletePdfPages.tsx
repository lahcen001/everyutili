"use client";

import * as React from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { FileMinus2, Loader2, X } from "lucide-react";

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

export default function DeletePdfPages() {
  useTrackTool("delete-pdf-pages");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [gridState, setGridState] = React.useState<VisualPdfPageGridState | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
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

  const selectedCount = gridState?.selected.size ?? 0;
  const orderCount = gridState?.order.length ?? pageCount;
  const remainingCount = orderCount - selectedCount;

  const deletePages = async () => {
    const state = gridRef.current?.getState() ?? gridState;
    if (!file || !state || state.selected.size === 0) return;
    const keptPages = state.order.filter((pageNumber) => !state.selected.has(pageNumber));
    if (keptPages.length === 0) {
      setError("You must keep at least one page.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(bytes);
      const outPdf = await PDFDocument.create();
      const copiedPages = await outPdf.copyPages(
        srcPdf,
        keptPages.map((pageNumber) => pageNumber - 1)
      );
      copiedPages.forEach((page, i) => {
        const rotationDeg = state.rotations[keptPages[i]] ?? 0;
        if (rotationDeg !== 0) {
          page.setRotation(degrees((page.getRotation().angle + rotationDeg) % 360));
        }
        outPdf.addPage(page);
      });
      const outBytes = await outPdf.save();
      const baseName = file.name.replace(/\.pdf$/i, "");
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const outName = `${baseName}-edited.pdf`;
      downloadBlob(blob, outName);

      const removedCount = state.selected.size;
      await saveToolResult("delete-pdf-pages", {
        title: outName,
        summary: `${removedCount} page${removedCount === 1 ? "" : "s"} removed · ${keptPages.length} remaining · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete pages.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Remove specific pages and download the result"
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Select pages to delete</span>
              <span className="text-xs text-muted-foreground">
                {selectedCount} page{selectedCount === 1 ? "" : "s"} will be removed ·{" "}
                {remainingCount} remaining
              </span>
            </div>

            <VisualPdfPageGrid ref={gridRef} file={file} onChange={setGridState} />

            <Button onClick={deletePages} disabled={isProcessing || selectedCount === 0}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Removing…
                </>
              ) : (
                <>
                  <FileMinus2 className="h-4 w-4" /> Delete Pages & Download
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="delete-pdf-pages" />
    </div>
  );
}
