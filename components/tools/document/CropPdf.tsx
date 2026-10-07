"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Crop, Download, Loader2, ScanSearch, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { NO_MARGINS, clampMargins, cropPdf, detectContentMargins, type Margins } from "@/lib/pdf/crop";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { openPdf, renderPageCanvas } from "@/lib/pdf/pdfjs";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

type Scope = "all" | "current" | "odd" | "even" | "range";
type Edge = keyof Margins;

const PRESETS: { label: string; margins: Margins }[] = [
  { label: "None", margins: NO_MARGINS },
  { label: "Small trim (3%)", margins: { top: 0.03, right: 0.03, bottom: 0.03, left: 0.03 } },
  { label: "Medium trim (8%)", margins: { top: 0.08, right: 0.08, bottom: 0.08, left: 0.08 } },
  { label: "Remove header & footer", margins: { top: 0.07, right: 0, bottom: 0.07, left: 0 } },
];

const pct = (n: number) => Math.round(n * 1000) / 10;

export default function CropPdf() {
  useTrackTool("crop-pdf");
  const [fileName, setFileName] = React.useState("");
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null);
  const [sizes, setSizes] = React.useState<{ width: number; height: number }[]>([]);
  const [page, setPage] = React.useState(0);
  const [pageUrl, setPageUrl] = React.useState<string | null>(null);
  const [margins, setMargins] = React.useState<Margins>(NO_MARGINS);
  const [perPage, setPerPage] = React.useState<Map<number, Margins> | null>(null);
  const [scope, setScope] = React.useState<Scope>("all");
  const [rangeText, setRangeText] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const pdfRef = React.useRef<Awaited<ReturnType<typeof openPdf>> | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const drag = React.useRef<{ edge: Edge; start: number; value: number } | null>(null);

  React.useEffect(() => {
    return () => {
      void pdfRef.current?.destroy();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const showPage = React.useCallback(async (index: number) => {
    const doc = pdfRef.current;
    if (!doc) return;
    const vp = (await doc.pdf.getPage(index + 1)).getViewport({ scale: 1 });
    const canvas = await renderPageCanvas(doc.pdf, index + 1, Math.min(2.2, 1000 / vp.width));
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render"))), "image/jpeg", 0.88));
    const url = URL.createObjectURL(blob);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setPageUrl(url);
  }, []);

  const openFile = async (files: File[]) => {
    const file = files.find(isPdfFile);
    if (!file) return setError("Please choose a PDF file.");
    setError(null);
    setBusy("Opening…");
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      await pdfRef.current?.destroy();
      const doc = await openPdf(data);
      pdfRef.current = doc;
      const dims: { width: number; height: number }[] = [];
      for (let n = 1; n <= doc.pdf.numPages; n++) {
        const vp = (await doc.pdf.getPage(n)).getViewport({ scale: 1 });
        dims.push({ width: vp.width, height: vp.height });
      }
      setSizes(dims);
      setBytes(data);
      setFileName(file.name);
      setMargins(NO_MARGINS);
      setPerPage(null);
      setPage(0);
      await showPage(0);
    } catch (e) {
      setError(friendlyPdfError(e, "Could not open this PDF."));
    } finally {
      setBusy(null);
    }
  };

  const goTo = async (index: number) => {
    const next = Math.min(Math.max(index, 0), sizes.length - 1);
    setPage(next);
    await showPage(next);
  };

  const targetPages = (): { pages: number[]; error?: string } => {
    const all = sizes.map((_, i) => i);
    if (scope === "all") return { pages: all };
    if (scope === "current") return { pages: [page] };
    if (scope === "odd") return { pages: all.filter((i) => i % 2 === 0) };
    if (scope === "even") return { pages: all.filter((i) => i % 2 === 1) };
    const r = parsePageRanges(rangeText, sizes.length);
    return r.error ? { pages: [], error: r.error } : { pages: r.pages.map((n) => n - 1) };
  };
  const target = targetPages();

  const shown = perPage?.get(page) ?? (target.pages.includes(page) ? margins : NO_MARGINS);

  const detectOne = async (index: number): Promise<Margins | null> => {
    const doc = pdfRef.current;
    if (!doc) return null;
    const canvas = await renderPageCanvas(doc.pdf, index + 1, 0.6);
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    return detectContentMargins(data.data, canvas.width, canvas.height);
  };

  const autoTrimCurrent = async () => {
    setBusy("Looking for content…");
    try {
      const m = await detectOne(page);
      if (!m) setError("This page looks blank, so there is nothing to trim to.");
      else {
        setError(null);
        setPerPage(null);
        setMargins(m);
      }
    } finally {
      setBusy(null);
    }
  };

  /** Measures every chosen page; `same` keeps the smallest margin on each side so no page loses content. */
  const autoTrimAll = async (same: boolean) => {
    setBusy("Measuring pages…");
    setError(null);
    try {
      const found = new Map<number, Margins>();
      for (const i of target.pages) {
        const m = await detectOne(i);
        if (m) found.set(i, m);
      }
      if (found.size === 0) return setError("No content found to trim to.");
      if (same) {
        const all = [...found.values()];
        setPerPage(null);
        setMargins({ top: Math.min(...all.map((m) => m.top)), right: Math.min(...all.map((m) => m.right)), bottom: Math.min(...all.map((m) => m.bottom)), left: Math.min(...all.map((m) => m.left)) });
      } else setPerPage(found);
    } finally {
      setBusy(null);
    }
  };

  const setEdge = (edge: Edge, value: number) => {
    setPerPage(null);
    setMargins((m) => clampMargins({ ...m, [edge]: value }));
  };

  const down = (e: React.PointerEvent, edge: Edge) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const vertical = edge === "top" || edge === "bottom";
    drag.current = { edge, start: vertical ? e.clientY : e.clientX, value: shown[edge] };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const rect = stage.getBoundingClientRect();
    const vertical = d.edge === "top" || d.edge === "bottom";
    const delta = ((vertical ? e.clientY : e.clientX) - d.start) / (vertical ? rect.height : rect.width);
    const sign = d.edge === "top" || d.edge === "left" ? 1 : -1;
    setPerPage(null);
    setMargins({ ...(perPage?.get(page) ?? margins), [d.edge]: Math.max(0, d.value + sign * delta) } as Margins);
    setMargins((m) => clampMargins(m));
  };
  const up = () => {
    drag.current = null;
  };

  const exportPdf = async () => {
    if (!bytes) return;
    if (target.error) return setError(target.error);
    setBusy("Cropping…");
    setError(null);
    try {
      const map = new Map<number, Margins>();
      for (const i of target.pages) map.set(i, perPage?.get(i) ?? margins);
      const out = await cropPdf(bytes, map);
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const name = fileName.replace(/\.pdf$/i, "") + "-cropped.pdf";
      downloadBlob(blob, name);
      await saveToolResult("crop-pdf", { title: name, summary: `${map.size} page${map.size === 1 ? "" : "s"} cropped · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Could not crop this PDF."));
    } finally {
      setBusy(null);
    }
  };

  const size = sizes[page];
  const resultMm = size ? { w: (size.width * (1 - shown.left - shown.right) * 25.4) / 72, h: (size.height * (1 - shown.top - shown.bottom) * 25.4) / 72 } : null;
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";
  const handle = "absolute z-10 touch-none bg-primary/80 hover:bg-primary";

  if (!bytes) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={(f) => void openFile(f)} accept="application/pdf" multiple={false} label="Drag & drop a PDF to crop, or click to browse" hint="Trim margins visually or automatically — nothing is uploaded" />
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {busy}
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <ToolHistoryList ref={historyRef} toolSlug="crop-pdf" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <p className="truncate text-sm font-medium" title={fileName}>
              {fileName} <span className="font-normal text-muted-foreground">· {sizes.length} page{sizes.length === 1 ? "" : "s"}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["top", "bottom", "left", "right"] as const).map((edge) => (
                <label key={edge} className="space-y-1 text-xs">
                  <span className="font-medium capitalize text-muted-foreground">{edge}: {pct(shown[edge])}%</span>
                  <input type="range" min={0} max={0.6} step={0.005} value={shown[edge]} onChange={(e) => setEdge(edge, Number(e.target.value))} aria-label={`Crop ${edge}`} className="w-full accent-primary" />
                </label>
              ))}
            </div>
            {resultMm && (
              <p className="text-xs text-muted-foreground">
                Page after cropping: about {resultMm.w.toFixed(0)} × {resultMm.h.toFixed(0)} mm
              </p>
            )}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => { setPerPage(null); setMargins(p.margins); }} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary">
                  {p.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium">Auto-trim white space</p>
            <div className="flex flex-col gap-2">
              <button className={btn} onClick={() => void autoTrimCurrent()} disabled={!!busy}>
                <ScanSearch className="h-4 w-4" /> Detect on this page
              </button>
              <button className={btn} onClick={() => void autoTrimAll(true)} disabled={!!busy || target.pages.length === 0} title="Uses the smallest margin found on any chosen page, so nothing is cut off">
                <ScanSearch className="h-4 w-4" /> Same trim for all chosen pages
              </button>
              <button className={btn} onClick={() => void autoTrimAll(false)} disabled={!!busy || target.pages.length === 0}>
                <ScanSearch className="h-4 w-4" /> Trim each page separately
              </button>
            </div>
            {perPage && <p className="text-xs text-emerald-700 dark:text-emerald-400">Each chosen page will be trimmed to its own content ({perPage.size} measured).</p>}
          </Card>

          <Card className="space-y-3 p-4">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Apply to</span>
              <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                <option value="all">All pages</option>
                <option value="current">This page only</option>
                <option value="odd">Odd pages (1, 3, 5…)</option>
                <option value="even">Even pages (2, 4, 6…)</option>
                <option value="range">A page range…</option>
              </select>
            </label>
            {scope === "range" && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Pages, e.g. 1-3, 7</span>
                <input value={rangeText} onChange={(e) => setRangeText(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                {target.error && <span className="text-xs text-destructive">{target.error}</span>}
              </label>
            )}
            <Button onClick={exportPdf} disabled={!!busy || target.pages.length === 0} className="w-full">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {busy}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download cropped PDF
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { void pdfRef.current?.destroy(); pdfRef.current = null; setBytes(null); setPageUrl(null); }}>
              <X className="h-3.5 w-3.5" /> Choose another PDF
            </Button>
            <p className="text-xs text-muted-foreground">The cropped-away area is hidden by the page&apos;s crop box, not deleted, so the file size stays about the same. To remove content for good, redact it before sharing.</p>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn} onClick={() => void goTo(page - 1)} disabled={page === 0} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm tabular-nums">
              Page <input type="number" min={1} max={sizes.length} value={page + 1} onChange={(e) => void goTo(Number(e.target.value) - 1)} aria-label="Page number" className="mx-1 h-8 w-16 rounded-md border border-border bg-background px-2 text-center" /> of {sizes.length}
            </span>
            <button className={btn} onClick={() => void goTo(page + 1)} disabled={page >= sizes.length - 1} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crop className="h-3.5 w-3.5" /> Drag the blue edges
            </span>
          </div>
          <div className="overflow-auto rounded-lg border border-border bg-muted/30 p-3">
            <div ref={stageRef} className="relative mx-auto select-none bg-white shadow-md" style={{ maxWidth: 900, aspectRatio: size ? `${size.width} / ${size.height}` : "3 / 4" }}>
              {pageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pageUrl} alt={`Page ${page + 1}`} draggable={false} className="absolute inset-0 h-full w-full" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/45" style={{ height: `${shown.top * 100}%` }} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45" style={{ height: `${shown.bottom * 100}%` }} />
              <div className="pointer-events-none absolute left-0 bg-black/45" style={{ top: `${shown.top * 100}%`, bottom: `${shown.bottom * 100}%`, width: `${shown.left * 100}%` }} />
              <div className="pointer-events-none absolute right-0 bg-black/45" style={{ top: `${shown.top * 100}%`, bottom: `${shown.bottom * 100}%`, width: `${shown.right * 100}%` }} />
              <div className={cn(handle, "inset-x-0 h-1.5 cursor-ns-resize")} style={{ top: `calc(${shown.top * 100}% - 3px)` }} onPointerDown={(e) => down(e, "top")} onPointerMove={move} onPointerUp={up} role="separator" aria-label="Top edge" />
              <div className={cn(handle, "inset-x-0 h-1.5 cursor-ns-resize")} style={{ bottom: `calc(${shown.bottom * 100}% - 3px)` }} onPointerDown={(e) => down(e, "bottom")} onPointerMove={move} onPointerUp={up} role="separator" aria-label="Bottom edge" />
              <div className={cn(handle, "inset-y-0 w-1.5 cursor-ew-resize")} style={{ left: `calc(${shown.left * 100}% - 3px)` }} onPointerDown={(e) => down(e, "left")} onPointerMove={move} onPointerUp={up} role="separator" aria-label="Left edge" />
              <div className={cn(handle, "inset-y-0 w-1.5 cursor-ew-resize")} style={{ right: `calc(${shown.right * 100}% - 3px)` }} onPointerDown={(e) => down(e, "right")} onPointerMove={move} onPointerUp={up} role="separator" aria-label="Right edge" />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ToolHistoryList ref={historyRef} toolSlug="crop-pdf" />
    </div>
  );
}
