"use client";

import * as React from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { Loader2, RotateCcw, RotateCw, X } from "lucide-react";

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
import { addRotation, normalizeAngle } from "@/lib/pdf/rotation";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";

export default function RotatePdf() {
  useTrackTool("rotate-pdf");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [gridState, setGridState] = React.useState<VisualPdfPageGridState | null>(null);
  const [isRotating, setIsRotating] = React.useState(false);
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

  const selectedCount = gridState?.selected.size ?? 0;

  const rotatePages = (pages: Iterable<number>, delta: number) => {
    const targets = new Set(pages);
    gridRef.current?.applyRotations?.((prev) => {
      const next = { ...prev };
      for (const pageNumber of targets) next[pageNumber] = normalizeAngle((next[pageNumber] ?? 0) + delta);
      return next;
    });
  };

  const allPages = gridState?.order ?? [];
  const oddPages = allPages.filter((p) => p % 2 === 1);
  const evenPages = allPages.filter((p) => p % 2 === 0);
  const selectedPages = gridState ? [...gridState.selected] : [];

  const resetRotations = () => {
    gridRef.current?.applyRotations?.(() => ({}));
  };

  const rotatePdf = async () => {
    const state = gridRef.current?.getState() ?? gridState;
    if (!file || !state) return;
    setIsRotating(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(bytes);
      const outPdf = await PDFDocument.create();
      const copiedPages = await outPdf.copyPages(
        srcPdf,
        state.order.map((pageNumber) => pageNumber - 1)
      );
      copiedPages.forEach((page, i) => {
        const rotationDeg = state.rotations[state.order[i]] ?? 0;
        if (rotationDeg !== 0) {
          page.setRotation(degrees(addRotation(page.getRotation().angle, rotationDeg)));
        }
        outPdf.addPage(page);
      });
      const outBytes = await outPdf.save();
      const baseName = file.name.replace(/\.pdf$/i, "");
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const outName = `${baseName}-rotated.pdf`;
      downloadBlob(blob, outName);

      const rotatedCount = state.order.filter((p) => (state.rotations[p] ?? 0) !== 0).length;
      await saveToolResult("rotate-pdf", {
        title: outName,
        summary: `${rotatedCount} of ${state.order.length} page${state.order.length === 1 ? "" : "s"} rotated · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to rotate PDF."));
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Rotate single pages, all pages, odd or even pages, or a selection — clockwise or counter-clockwise"
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

          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-sm font-medium">All pages</span>
              <Button size="sm" variant="outline" onClick={() => rotatePages(allPages, 90)} disabled={pageCount === 0}>
                <RotateCw className="h-3.5 w-3.5" /> 90° clockwise
              </Button>
              <Button size="sm" variant="outline" onClick={() => rotatePages(allPages, -90)} disabled={pageCount === 0}>
                <RotateCcw className="h-3.5 w-3.5" /> 90° counter-clockwise
              </Button>
              <Button size="sm" variant="outline" onClick={() => rotatePages(allPages, 180)} disabled={pageCount === 0}>
                180°
              </Button>
              <Button size="sm" variant="ghost" onClick={resetRotations} disabled={pageCount === 0}>
                Reset all
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-sm font-medium">Odd / even</span>
              <Button size="sm" variant="outline" onClick={() => rotatePages(oddPages, 90)} disabled={oddPages.length === 0}>
                Odd pages ↻
              </Button>
              <Button size="sm" variant="outline" onClick={() => rotatePages(evenPages, 90)} disabled={evenPages.length === 0}>
                Even pages ↻
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-sm font-medium">Selected</span>
              <Button size="sm" variant="outline" onClick={() => rotatePages(selectedPages, 90)} disabled={selectedCount === 0}>
                <RotateCw className="h-3.5 w-3.5" /> 90° clockwise
              </Button>
              <Button size="sm" variant="outline" onClick={() => rotatePages(selectedPages, -90)} disabled={selectedCount === 0}>
                <RotateCcw className="h-3.5 w-3.5" /> 90° counter-clockwise
              </Button>
              <Button size="sm" variant="outline" onClick={() => rotatePages(selectedPages, 180)} disabled={selectedCount === 0}>
                180°
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedCount} page{selectedCount === 1 ? "" : "s"} selected
              </span>
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <VisualPdfPageGrid ref={gridRef} file={file} onChange={setGridState} />

            <Button onClick={rotatePdf} disabled={isRotating}>
              {isRotating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Rotating…
                </>
              ) : (
                <>
                  <RotateCw className="h-4 w-4" /> Rotate & Download
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="rotate-pdf" />
    </div>
  );
}
