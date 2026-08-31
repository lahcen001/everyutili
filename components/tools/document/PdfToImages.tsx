"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, FileImage, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";

interface PagePreview {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
}

export default function PdfToImages() {
  useTrackTool("pdf-to-images");
  const [file, setFile] = React.useState<File | null>(null);
  const [pages, setPages] = React.useState<PagePreview[]>([]);
  const [isRendering, setIsRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = async (files: File[]) => {
    const pdfFile = files.find((f) => f.type === "application/pdf");
    if (!pdfFile) return;
    setFile(pdfFile);
    setPages([]);
    setError(null);
    setIsRendering(true);

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const bytes = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const rendered: PagePreview[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not acquire canvas context");
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;

        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Render failed"))), "image/png");
        });

        rendered.push({ pageNumber: pageNum, dataUrl: canvas.toDataURL("image/png"), blob });
      }

      setPages(rendered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to render PDF pages.");
    } finally {
      setIsRendering(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPages([]);
    setError(null);
  };

  const downloadPage = async (page: PagePreview) => {
    const baseName = file?.name.replace(/\.pdf$/i, "") ?? "page";
    const outName = `${baseName}-page-${page.pageNumber}.png`;
    downloadBlob(page.blob, outName);

    await saveToolResult("pdf-to-images", {
      title: outName,
      summary: `Page ${page.pageNumber} of ${pages.length} · ${formatBytes(page.blob.size)}`,
      blob: page.blob,
    });
    historyRef.current?.refresh();
  };

  const downloadAllAsZip = async () => {
    if (pages.length === 0) return;
    const baseName = file?.name.replace(/\.pdf$/i, "") ?? "pdf";
    const zip = new JSZip();
    pages.forEach((page) => zip.file(`${baseName}-page-${page.pageNumber}.png`, page.blob));
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const outName = `${baseName}-images.zip`;
    downloadBlob(zipBlob, outName);

    await saveToolResult("pdf-to-images", {
      title: outName,
      summary: `${pages.length} page${pages.length === 1 ? "" : "s"} · ${formatBytes(zipBlob.size)}`,
      blob: zipBlob,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Each page is rendered to a high-resolution PNG image"
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && (
        <Card className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
              {pages.length > 0 && ` · ${pages.length} pages rendered`}
            </p>
          </div>
          {isRendering && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
          {pages.length > 0 && (
            <Button size="sm" variant="outline" onClick={downloadAllAsZip}>
              <Download className="h-3.5 w-3.5" /> Download ZIP
            </Button>
          )}
          <button
            onClick={removeFile}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </Card>
      )}

      {pages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Card key={page.pageNumber} className="space-y-2 p-3">
              <img
                src={page.dataUrl}
                alt={`Page ${page.pageNumber}`}
                className="w-full rounded-lg border border-border"
              />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileImage className="h-3.5 w-3.5" /> Page {page.pageNumber}
                </span>
                <Button size="sm" variant="ghost" onClick={() => downloadPage(page)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="pdf-to-images" />
    </div>
  );
}
