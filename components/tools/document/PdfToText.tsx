"use client";

import * as React from "react";
import { Download, FileText, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { itemsToLines, reflowLines, type PdfTextItem } from "@/lib/pdf/text";
import { formatBytes } from "@/lib/format";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

interface PageText {
  pageNumber: number;
  lines: string[];
}

export default function PdfToText() {
  useTrackTool("pdf-to-text");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [pages, setPages] = React.useState<PageText[]>([]);
  const [rangeText, setRangeText] = React.useState("");
  const [reflow, setReflow] = React.useState(false);
  const [markers, setMarkers] = React.useState(true);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const bytesRef = React.useRef<ArrayBuffer | null>(null);

  const range = parsePageRanges(rangeText, pageCount);

  const handleFiles = async (files: File[]) => {
    const pdfFile = files.find((f) => isPdfFile(f));
    if (!pdfFile) return;
    setError(null);
    setPages([]);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const bytes = await pdfFile.arrayBuffer();
      const task = pdfjsLib.getDocument({ data: bytes.slice(0) });
      const pdf = await task.promise;
      setPageCount(pdf.numPages);
      await task.destroy();
      bytesRef.current = bytes;
      setFile(pdfFile);
      setRangeText("");
    } catch (e) {
      setError(friendlyPdfError(e, "Could not open this PDF."));
    }
  };

  const extract = async () => {
    if (!bytesRef.current || range.error || range.pages.length === 0) return;
    setError(null);
    setPages([]);
    setProgress({ done: 0, total: range.pages.length });
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdfjsLib.getDocument({ data: bytesRef.current.slice(0) });
      const pdf = await task.promise;
      const out: PageText[] = [];
      for (let i = 0; i < range.pages.length; i++) {
        const page = await pdf.getPage(range.pages[i]);
        const content = await page.getTextContent();
        const items: PdfTextItem[] = content.items
          .filter((it): it is (typeof content.items)[number] & { str: string; transform: number[]; width: number; height: number } => "str" in it)
          .map((it) => ({ str: it.str, transform: it.transform, width: it.width, height: it.height }));
        out.push({ pageNumber: range.pages[i], lines: itemsToLines(items) });
        page.cleanup();
        setProgress({ done: i + 1, total: range.pages.length });
      }
      await task.destroy();
      setPages(out);
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to read the text of this PDF."));
    } finally {
      setProgress(null);
    }
  };

  const text = pages
    .map((p) => {
      const body = reflow ? reflowLines(p.lines) : p.lines.join("\n");
      return markers ? `--- Page ${p.pageNumber} ---\n${body}` : body;
    })
    .join("\n\n");
  const totalChars = pages.reduce((sum, p) => sum + p.lines.join("").length, 0);
  const noText = pages.length > 0 && totalChars < 20;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  const download = async () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const name = `${file?.name.replace(/\.pdf$/i, "") ?? "document"}.txt`;
    downloadBlob(blob, name);
    await saveToolResult("pdf-to-text", { title: name, summary: `${pages.length} page${pages.length === 1 ? "" : "s"} · ${words.toLocaleString()} words · ${formatBytes(blob.size)}`, blob });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <DropZone onFiles={handleFiles} accept="application/pdf" multiple={false} label="Drag & drop a PDF here, or click to browse" hint="Extracts the text layer — nothing is uploaded" />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && (
        <>
          <Card className="flex items-center gap-3 p-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · {pageCount} page{pageCount === 1 ? "" : "s"}
              </p>
            </div>
            <button onClick={() => { setFile(null); setPages([]); bytesRef.current = null; }} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
              <X className="h-4 w-4" />
            </button>
          </Card>

          <Card className="space-y-4 p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Pages</span>
              <input value={rangeText} onChange={(e) => setRangeText(e.target.value)} placeholder="All pages — or e.g. 1-5, 9" className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className={cn("block text-xs", range.error ? "text-destructive" : "text-muted-foreground")}>{range.error ?? `${range.pages.length} of ${pageCount} pages`}</span>
            </label>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={markers} onChange={(e) => setMarkers(e.target.checked)} className="h-4 w-4 rounded border-border" /> Mark where each page starts
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={reflow} onChange={(e) => setReflow(e.target.checked)} className="h-4 w-4 rounded border-border" /> Join wrapped lines into paragraphs
              </label>
            </div>
            <Button onClick={extract} disabled={progress !== null || Boolean(range.error) || range.pages.length === 0}>
              {progress ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Page {progress.done} of {progress.total}…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" /> Extract text
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      {noText && (
        <div role="status" className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          This PDF has almost no selectable text — it is probably a scan (a picture of pages). Reading text from scans needs OCR, which this tool doesn&apos;t do.
        </div>
      )}

      {pages.length > 0 && !noText && (
        <Card className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            {words.toLocaleString()} words · {text.length.toLocaleString()} characters
          </p>
          <textarea readOnly value={text} aria-label="Extracted text" className="h-80 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none" />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={text} variant="outline" size="sm">
              Copy text
            </CopyButton>
            <Button size="sm" onClick={download}>
              <Download className="h-3.5 w-3.5" /> Download .txt
            </Button>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="pdf-to-text" />
    </div>
  );
}
