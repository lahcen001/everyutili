"use client";

import * as React from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { ArrowDown, ArrowUp, Download, FileText, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import {
  MultiFilePdfPageGrid,
  type MultiFilePdfPageGridHandle,
  type MultiFilePdfPageId,
} from "@/components/tools/document/MultiFilePdfPageGrid";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { pageAllowed, parsePageIntervals } from "@/lib/pdf/ranges";
import { addRotation } from "@/lib/pdf/rotation";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";

interface PdfItem {
  id: string;
  file: File;
}

export default function MergePdf() {
  useTrackTool("merge-pdf");
  const [items, setItems] = React.useState<PdfItem[]>([]);
  const [pageOrder, setPageOrder] = React.useState<MultiFilePdfPageId[]>([]);
  const [ranges, setRanges] = React.useState<Record<string, string>>({});
  const [isMerging, setIsMerging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const gridRef = React.useRef<MultiFilePdfPageGridHandle>(null);

  const files = React.useMemo(() => items.map((item) => item.file), [items]);

  const handleFiles = (newFiles: File[]) => {
    const pdfFiles = newFiles.filter((f) => isPdfFile(f));
    setItems((prev) => [...prev, ...pdfFiles.map((file) => ({ id: crypto.randomUUID(), file }))]);
    setError(null);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const moveItem = (index: number, direction: -1 | 1) =>
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const intervalsFor = (id: string) => parsePageIntervals(ranges[id] ?? "");

  const mergePdfs = async () => {
    if (items.length < 2) {
      setError("Add at least two PDF files to merge.");
      return;
    }
    for (const item of items) {
      const check = intervalsFor(item.id);
      if (check.error) {
        setError(`${item.file.name}: ${check.error}`);
        return;
      }
    }
    // A per-file page range keeps only those pages of that file, on top of whatever the page grid shows.
    const order = (gridRef.current?.getOrder() ?? pageOrder).filter(({ fileIndex, pageNumber }) => {
      const item = items[fileIndex];
      return !item || pageAllowed(pageNumber, intervalsFor(item.id).intervals);
    });
    if (order.length === 0) {
      setError("There are no pages left to merge.");
      return;
    }
    const rotations = gridRef.current?.getRotations() ?? {};
    setIsMerging(true);
    setError(null);

    try {
      const sourcePdfs = await Promise.all(
        items.map((item) => item.file.arrayBuffer().then((bytes) => PDFDocument.load(bytes)))
      );

      const mergedPdf = await PDFDocument.create();

      for (const { fileIndex, pageNumber } of order) {
        const srcPdf = sourcePdfs[fileIndex];
        if (!srcPdf) continue;
        const [copiedPage] = await mergedPdf.copyPages(srcPdf, [pageNumber - 1]);
        const rotationDeg = rotations[`${fileIndex}:${pageNumber}`] ?? 0;
        if (rotationDeg !== 0) {
          copiedPage.setRotation(degrees(addRotation(copiedPage.getRotation().angle, rotationDeg)));
        }
        mergedPdf.addPage(copiedPage);
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
      downloadBlob(blob, "merged.pdf");

      await saveToolResult("merge-pdf", {
        title: "merged.pdf",
        summary: `${items.length} files merged · ${order.length} pages · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to merge PDFs."));
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        label="Drag & drop PDF files here, or click to browse"
        hint="Add two or more PDFs, then drag pages below to interleave them"
      />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="grid gap-2">
            {items.map((item, index) => {
              const rangeCheck = intervalsFor(item.id);
              return (
                <Card key={item.id} className="space-y-2 p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {index + 1}. {item.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                    </div>
                    <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label={`Move ${item.file.name} up`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label={`Move ${item.file.name} down`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button onClick={() => removeItem(item.id)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    Only use pages
                    <input
                      value={ranges[item.id] ?? ""}
                      onChange={(e) => setRanges((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="all — or e.g. 1-3, 7, 10-"
                      aria-label={`Pages to use from ${item.file.name}`}
                      className="h-8 w-52 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                    {rangeCheck.error && <span className="text-destructive">{rangeCheck.error}</span>}
                  </label>
                </Card>
              );
            })}
          </div>

          {items.length >= 2 ? (
            <Card className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Arrange pages</span>
                <span className="text-xs text-muted-foreground">
                  Drag pages to interleave files, or remove pages you don&apos;t need
                </span>
              </div>
              <MultiFilePdfPageGrid ref={gridRef} files={files} onChange={setPageOrder} />
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              Add at least one more PDF to arrange and merge pages.
            </div>
          )}

          <Button onClick={mergePdfs} disabled={isMerging || items.length < 2}>
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Merging…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Merge & Download PDF
              </>
            )}
          </Button>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="merge-pdf" />
    </div>
  );
}
