"use client";

import * as React from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { Download, FileText, Loader2, X } from "lucide-react";

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

interface PdfItem {
  id: string;
  file: File;
}

export default function MergePdf() {
  useTrackTool("merge-pdf");
  const [items, setItems] = React.useState<PdfItem[]>([]);
  const [pageOrder, setPageOrder] = React.useState<MultiFilePdfPageId[]>([]);
  const [isMerging, setIsMerging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const gridRef = React.useRef<MultiFilePdfPageGridHandle>(null);

  const files = React.useMemo(() => items.map((item) => item.file), [items]);

  const handleFiles = (newFiles: File[]) => {
    const pdfFiles = newFiles.filter((f) => f.type === "application/pdf");
    setItems((prev) => [...prev, ...pdfFiles.map((file) => ({ id: crypto.randomUUID(), file }))]);
    setError(null);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const mergePdfs = async () => {
    if (items.length < 2) {
      setError("Add at least two PDF files to merge.");
      return;
    }
    const order = gridRef.current?.getOrder() ?? pageOrder;
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
          copiedPage.setRotation(degrees((copiedPage.getRotation().angle + rotationDeg) % 360));
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
      setError(e instanceof Error ? e.message : "Failed to merge PDFs.");
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
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="grid gap-2">
            {items.map((item) => (
              <Card key={item.id} className="flex items-center gap-3 p-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </Card>
            ))}
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
