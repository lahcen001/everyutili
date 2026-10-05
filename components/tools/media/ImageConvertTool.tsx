"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, FileImage, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { ImageComparisonSlider } from "@/components/tools/media/ImageComparisonSlider";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { rasterizeSvg } from "@/lib/svgRaster";
import { cn } from "@/lib/utils";
import type { ImageConvertRequest, ImageConvertResponse, ImageOutputFormat } from "@/workers/image-converter.worker";

export interface ImageConvertToolProps {
  /** Tool slug, used for analytics and history */
  slug: string;
  output: ImageOutputFormat;
  /** `accept` attribute for the drop zone */
  accept: string;
  /** Returns true for files this tool should take */
  matches: (file: File) => boolean;
  defaultQuality?: number;
  dropLabel: string;
  dropHint: string;
  /** Source is SVG: ask for an output width (SVGs have no fixed pixel size) */
  svg?: boolean;
}

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  aspectRatio: number;
  resultBlob?: Blob;
  resultName?: string;
  originalUrl?: string;
  processedUrl?: string;
  error?: string;
}

const OUTPUT_LABEL: Record<ImageOutputFormat, string> = { png: "PNG", jpeg: "JPG", webp: "WebP" };
const BACKGROUNDS = [
  { value: "#ffffff", label: "White" },
  { value: "#000000", label: "Black" },
  { value: "#f3f4f6", label: "Light grey" },
];
const DEFAULT_SVG_WIDTH = 512;

/** SVGs often omit width/height, so read the aspect ratio ourselves and always pass explicit sizes to the worker. */
async function readSvgAspectRatio(file: File): Promise<number> {
  const svg = new DOMParser().parseFromString(await file.text(), "image/svg+xml").documentElement;
  const w = parseFloat(svg.getAttribute("width") ?? "");
  const h = parseFloat(svg.getAttribute("height") ?? "");
  if (w > 0 && h > 0) return h / w;
  const vb = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) return vb[3] / vb[2];
  return 1;
}

export default function ImageConvertTool({ slug, output, accept, matches, defaultQuality = 0.9, dropLabel, dropHint, svg = false }: ImageConvertToolProps) {
  useTrackTool(slug);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [quality, setQuality] = React.useState(defaultQuality);
  const [background, setBackground] = React.useState("#ffffff");
  const [svgWidth, setSvgWidth] = React.useState(DEFAULT_SVG_WIDTH);
  const [resize, setResize] = React.useState(false);
  const [maxWidth, setMaxWidth] = React.useState(1920);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const urlsRef = React.useRef<Set<string>>(new Set());
  const label = OUTPUT_LABEL[output];

  React.useEffect(() => {
    workerRef.current = new Worker(new URL("@/workers/image-converter.worker.ts", import.meta.url));
    const urls = urlsRef.current;
    return () => {
      workerRef.current?.terminate();
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const handleFiles = async (files: File[]) => {
    const items = await Promise.all(
      files.filter(matches).map(async (file) => ({ id: crypto.randomUUID(), file, status: "pending" as const, aspectRatio: svg ? await readSvgAspectRatio(file).catch(() => 1) : 1 }))
    );
    setQueue((prev) => [...prev, ...items]);
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>.
  useIncomingHandoff((file) => void handleFiles([file]));

  const removeItem = (id: string) => {
    const item = queue.find((q) => q.id === id);
    for (const u of [item?.originalUrl, item?.processedUrl]) {
      if (u) {
        URL.revokeObjectURL(u);
        urlsRef.current.delete(u);
      }
    }
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const convertAll = async () => {
    const worker = workerRef.current;
    if (!worker || queue.length === 0) return;
    setIsProcessing(true);
    const pending = queue.filter((item) => item.status === "pending" || item.status === "error");

    for (const item of pending) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q)));

      let result: ImageConvertResponse;
      if (svg) {
        // SVG is rasterized on the main thread through an <img>; a worker's createImageBitmap can't decode SVG everywhere.
        const height = Math.max(1, Math.round(svgWidth * item.aspectRatio));
        try {
          const out = await rasterizeSvg(item.file, svgWidth, height, output, output === "png" ? 1 : quality, background);
          result = { id: item.id, status: "success", blob: out.blob, fileName: out.fileName };
        } catch (e) {
          result = { id: item.id, status: "error", message: e instanceof Error ? e.message : "Conversion failed" };
        }
      } else {
        result = await new Promise<ImageConvertResponse>((resolve) => {
          const onMessage = (event: MessageEvent<ImageConvertResponse>) => {
            if (event.data.id === item.id) {
              worker.removeEventListener("message", onMessage);
              resolve(event.data);
            }
          };
          worker.addEventListener("message", onMessage);
          const request: ImageConvertRequest = {
            id: item.id,
            file: item.file,
            format: output,
            quality: output === "png" ? 1 : quality,
            maxWidth: resize ? maxWidth : null,
            background,
          };
          worker.postMessage(request);
        });
      }

      let originalUrl: string | undefined;
      let processedUrl: string | undefined;
      if (result.status === "success") {
        processedUrl = URL.createObjectURL(result.blob);
        urlsRef.current.add(processedUrl);
        // An SVG "original" is a vector — show it only for raster sources.
        if (!svg) {
          originalUrl = URL.createObjectURL(item.file);
          urlsRef.current.add(originalUrl);
        }
      }

      setQueue((prev) =>
        prev.map((q) => {
          if (q.id !== item.id) return q;
          if (result.status === "success") return { ...q, status: "done", resultBlob: result.blob, resultName: result.fileName, originalUrl, processedUrl };
          return { ...q, status: "error", error: result.message };
        })
      );

      if (result.status === "success") {
        await saveToolResult(slug, { title: result.fileName, summary: `${item.file.name} → ${formatBytes(result.blob.size)}`, blob: result.blob });
        historyRef.current?.refresh();
      }
    }
    setIsProcessing(false);
  };

  const downloadAllAsZip = async () => {
    const done = queue.filter((item) => item.status === "done" && item.resultBlob && item.resultName);
    if (done.length === 0) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const item of done) {
      let name = item.resultName!;
      for (let n = 2; used.has(name); n++) name = item.resultName!.replace(/(\.[^.]+)$/, `-${n}$1`);
      used.add(name);
      zip.file(name, item.resultBlob!);
    }
    downloadBlob(await zip.generateAsync({ type: "blob" }), `converted-${label.toLowerCase()}.zip`);
  };

  const doneItems = queue.filter((item) => item.status === "done");
  const totalCount = queue.length;
  const progressPct = totalCount === 0 ? 0 : (doneItems.length / totalCount) * 100;
  const before = doneItems.reduce((s, i) => s + i.file.size, 0);
  const after = doneItems.reduce((s, i) => s + (i.resultBlob?.size ?? 0), 0);
  const changeText = (orig: number, now: number) => {
    const pct = orig > 0 ? Math.round((Math.abs(now - orig) / orig) * 100) : 0;
    return now <= orig ? `${pct}% smaller` : `${pct}% larger`;
  };

  return (
    <div className="space-y-6">
      <DropZone onFiles={(f) => void handleFiles(f)} accept={accept} label={dropLabel} hint={dropHint} />

      {queue.length > 0 && (
        <>
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {svg && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Output width</span>
                  <input type="number" min={16} max={8000} value={svgWidth} onChange={(e) => setSvgWidth(Math.max(16, Math.min(8000, Number(e.target.value) || DEFAULT_SVG_WIDTH)))} className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="text-muted-foreground">px</span>
                </label>
              )}
              {output !== "png" && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Quality</span>
                  <input type="range" min={0.4} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-28 accent-primary" />
                  <span className="w-10 text-right text-muted-foreground">{Math.round(quality * 100)}%</span>
                </label>
              )}
              {output === "jpeg" && (
                <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Background colour">
                  <span className="font-medium">Background</span>
                  {BACKGROUNDS.map((b) => (
                    <button key={b.value} onClick={() => setBackground(b.value)} aria-pressed={background === b.value} title={b.label} aria-label={b.label} className={cn("h-7 w-7 rounded-full border-2 transition-shadow", background === b.value ? "border-primary ring-2 ring-primary/30" : "border-border")} style={{ backgroundColor: b.value }} />
                  ))}
                  <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} aria-label="Custom background colour" className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0" />
                  <span className="text-xs text-muted-foreground">fills transparent areas (JPG has no transparency)</span>
                </div>
              )}
              {!svg && (
                <div className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={resize} onChange={(e) => setResize(e.target.checked)} className="h-4 w-4 rounded border-border" /> Limit width to
                  </label>
                  <input type="number" min={16} max={16000} value={maxWidth} disabled={!resize} onChange={(e) => setMaxWidth(Math.max(16, Number(e.target.value) || 1920))} aria-label="Maximum width" className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="text-muted-foreground">px</span>
                </div>
              )}
            </div>
            {output === "png" && <p className="text-xs text-muted-foreground">PNG is lossless, so there is no quality setting — file size depends on the image itself.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={convertAll} disabled={isProcessing || queue.every((q) => q.status === "done")}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Converting…
                  </>
                ) : doneItems.length > 0 && doneItems.length < totalCount ? (
                  "Convert remaining"
                ) : (
                  `Convert to ${label}`
                )}
              </Button>
              {doneItems.length > 0 && (
                <Button variant="outline" onClick={downloadAllAsZip}>
                  <Download className="h-4 w-4" /> Download ZIP ({doneItems.length})
                </Button>
              )}
              {doneItems.length > 0 && (
                <span className="text-sm text-muted-foreground" role="status">
                  {formatBytes(before)} → {formatBytes(after)} ({changeText(before, after)})
                </span>
              )}
            </div>
            {doneItems.length > 0 && (
              <p className="text-xs text-muted-foreground">Changed a setting? Remove a file and add it again to convert it with the new settings.</p>
            )}
          </Card>

          <Progress value={progressPct} aria-label="Conversion progress" />

          <div className="grid gap-2">
            {queue.map((item) => (
              <Card key={item.id} className="space-y-3 p-3">
                <div className="flex items-center gap-3">
                  <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(item.file.size)}
                      {item.resultBlob && ` → ${formatBytes(item.resultBlob.size)} (${changeText(item.file.size, item.resultBlob.size)})`}
                      {item.status === "error" && <span className="ml-2 text-destructive">{item.error}</span>}
                    </p>
                  </div>
                  {item.status === "processing" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
                  {item.status === "done" && item.resultBlob && item.resultName && (
                    <Button size="sm" variant="outline" onClick={() => downloadBlob(item.resultBlob!, item.resultName!)}>
                      <Download className="h-3.5 w-3.5" /> Save
                    </Button>
                  )}
                  <button onClick={() => removeItem(item.id)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {item.status === "done" && item.processedUrl && item.originalUrl && item.resultBlob && (
                  <ImageComparisonSlider originalUrl={item.originalUrl} processedUrl={item.processedUrl} originalLabel={`Original: ${formatBytes(item.file.size)}`} processedLabel={`${label}: ${formatBytes(item.resultBlob.size)}`} />
                )}
                {item.status === "done" && item.processedUrl && !item.originalUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.processedUrl} alt={`${item.resultName} preview`} className="max-h-48 rounded border border-border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]" />
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug={slug} />
    </div>
  );
}
