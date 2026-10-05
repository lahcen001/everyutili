"use client";

import * as React from "react";
import JSZip from "jszip";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { Download, FileImage, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { cn } from "@/lib/utils";

type ImageFormat = "png" | "jpeg" | "webp";

const FORMATS: { id: ImageFormat; label: string; mime: string; extension: string }[] = [
  { id: "png", label: "PNG", mime: "image/png", extension: "png" },
  { id: "jpeg", label: "JPG", mime: "image/jpeg", extension: "jpg" },
  { id: "webp", label: "WebP", mime: "image/webp", extension: "webp" },
];

const DPI_CHOICES = [72, 96, 150, 200, 300];
/** Longest allowed side of a rendered page in px, so poster-size pages can't exhaust memory. */
const MAX_SIDE_PX = 8000;
const PAGE_WARNING = 100;

interface RenderedPage {
  pageNumber: number;
  url: string;
  blob: Blob;
}

export default function PdfToImages() {
  useTrackTool("pdf-to-images");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [format, setFormat] = React.useState<ImageFormat>("png");
  const [dpi, setDpi] = React.useState(150);
  const [quality, setQuality] = React.useState(0.9);
  const [rangeText, setRangeText] = React.useState("");
  const [pages, setPages] = React.useState<RenderedPage[]>([]);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const taskRef = React.useRef<PDFDocumentLoadingTask | null>(null);
  const pagesRef = React.useRef<RenderedPage[]>([]);
  const cancelRef = React.useRef(false);

  const formatMeta = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const range = parsePageRanges(rangeText, pageCount);
  const isRendering = progress !== null;

  const releasePages = React.useCallback((list: RenderedPage[]) => {
    list.forEach((p) => URL.revokeObjectURL(p.url));
  }, []);

  const closeDocument = React.useCallback(() => {
    cancelRef.current = true;
    void taskRef.current?.destroy();
    taskRef.current = null;
  }, []);

  React.useEffect(() => {
    return () => {
      closeDocument();
      releasePages(pagesRef.current);
    };
  }, [closeDocument, releasePages]);

  const handleFiles = async (files: File[]) => {
    const pdfFile = files.find((f) => isPdfFile(f));
    if (!pdfFile) return;
    closeDocument();
    releasePages(pagesRef.current);
    pagesRef.current = [];
    setPages([]);
    setError(null);
    setRangeText("");
    setIsLoading(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() });
      const pdf = await task.promise;
      taskRef.current = task;
      cancelRef.current = false;
      setPageCount(pdf.numPages);
      setFile(pdfFile);
    } catch (e) {
      setFile(null);
      setPageCount(0);
      setError(friendlyPdfError(e, "Could not open this PDF."));
    } finally {
      setIsLoading(false);
    }
  };

  const removeFile = () => {
    closeDocument();
    releasePages(pagesRef.current);
    pagesRef.current = [];
    setPages([]);
    setFile(null);
    setPageCount(0);
    setProgress(null);
    setError(null);
  };

  const render = async () => {
    const task = taskRef.current;
    if (!task || range.error || range.pages.length === 0) return;
    releasePages(pagesRef.current);
    pagesRef.current = [];
    setPages([]);
    setError(null);
    cancelRef.current = false;
    setProgress({ done: 0, total: range.pages.length });
    try {
      const pdf = await task.promise;
      const out: RenderedPage[] = [];
      for (let i = 0; i < range.pages.length; i++) {
        if (cancelRef.current) return;
        const pageNumber = range.pages[i];
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(dpi / 72, MAX_SIDE_PX / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not acquire canvas context");
        if (format === "jpeg") {
          ctx.fillStyle = "#ffffff"; // JPEG has no transparency
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the page image"))), formatMeta.mime, format === "png" ? undefined : quality)
        );
        out.push({ pageNumber, url: URL.createObjectURL(blob), blob });
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        pagesRef.current = [...out];
        setPages([...out]);
        setProgress({ done: i + 1, total: range.pages.length });
      }
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to render PDF pages."));
    } finally {
      setProgress(null);
    }
  };

  const baseName = file?.name.replace(/\.pdf$/i, "") ?? "pdf";
  const nameFor = (n: number) => `${baseName}-page-${String(n).padStart(String(pageCount).length, "0")}.${formatMeta.extension}`;

  const downloadPage = async (page: RenderedPage) => {
    const outName = nameFor(page.pageNumber);
    downloadBlob(page.blob, outName);
    await saveToolResult("pdf-to-images", { title: outName, summary: `Page ${page.pageNumber} of ${pageCount} · ${formatBytes(page.blob.size)}`, blob: page.blob });
    historyRef.current?.refresh();
  };

  const downloadAllAsZip = async () => {
    if (pages.length === 0) return;
    const zip = new JSZip();
    pages.forEach((page) => zip.file(nameFor(page.pageNumber), page.blob));
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const outName = `${baseName}-images.zip`;
    downloadBlob(zipBlob, outName);
    await saveToolResult("pdf-to-images", { title: outName, summary: `${pages.length} page${pages.length === 1 ? "" : "s"} · ${formatMeta.label} · ${dpi} DPI · ${formatBytes(zipBlob.size)}`, blob: zipBlob });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Choose PNG, JPG or WebP, the resolution and the pages — then render"
      />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening PDF…
        </div>
      )}

      {file && (
        <>
          <Card className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · {pageCount} page{pageCount === 1 ? "" : "s"}
              </p>
            </div>
            {pages.length > 0 && !isRendering && (
              <Button size="sm" variant="outline" onClick={downloadAllAsZip}>
                <Download className="h-3.5 w-3.5" /> Download ZIP
              </Button>
            )}
            <button onClick={removeFile} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
              <X className="h-4 w-4" />
            </button>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Format</p>
                <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Image format">
                  {FORMATS.map((f) => (
                    <button key={f.id} onClick={() => setFormat(f.id)} aria-pressed={format === f.id} className={cn("px-3 py-1.5 font-medium transition-colors", format === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Resolution</p>
                <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Resolution in DPI">
                  {DPI_CHOICES.map((d) => (
                    <button key={d} onClick={() => setDpi(d)} aria-pressed={dpi === d} className={cn("px-3 py-1.5 font-medium transition-colors", dpi === d ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {format !== "png" && (
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Quality: {Math.round(quality * 100)}%</span>
                  <input type="range" min={0.5} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="block w-40" aria-label="Image quality" />
                </label>
              )}
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Pages</span>
              <input
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="All pages — or e.g. 1-3, 7, 10-"
                className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className={cn("block text-xs", range.error ? "text-destructive" : "text-muted-foreground")}>
                {range.error ?? `${range.pages.length} of ${pageCount} page${pageCount === 1 ? "" : "s"} will be rendered.`}
              </span>
            </label>
            {!range.error && range.pages.length > PAGE_WARNING && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Rendering {range.pages.length} pages keeps every image in memory. If the tab slows down, render a smaller range or a lower resolution.
              </p>
            )}
            <Button onClick={render} disabled={isRendering || isLoading || Boolean(range.error) || range.pages.length === 0}>
              {isRendering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Page {progress?.done} of {progress?.total}…
                </>
              ) : (
                <>
                  <FileImage className="h-4 w-4" /> Render pages
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      {pages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Card key={page.pageNumber} className="space-y-2 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.url} alt={`Page ${page.pageNumber}`} className="w-full rounded-lg border border-border bg-white" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileImage className="h-3.5 w-3.5" /> Page {page.pageNumber} · {formatBytes(page.blob.size)}
                </span>
                <Button size="sm" variant="ghost" onClick={() => downloadPage(page)} aria-label={`Download page ${page.pageNumber}`}>
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
