"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, Loader2, PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { SidebarSection, SliderRow } from "@/components/tools/shared/EditorLayout";
import { ImageComparisonSlider } from "@/components/tools/media/ImageComparisonSlider";
import { BatchWorkspace } from "@/components/tools/media/BatchWorkspace";
import { useBatchProcessor, type BatchProcessable } from "@/components/tools/media/useBatchProcessor";
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

interface QueueItem extends BatchProcessable {
  file: File;
  aspectRatio: number;
  thumbUrl: string;
  error?: string;
  resultBlob?: Blob;
  resultName?: string;
  /** Object URL of the original (raster sources only) */
  originalUrl?: string;
  processedUrl?: string;
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

const pct = (orig: number, now: number) => (orig > 0 ? Math.round((Math.abs(now - orig) / orig) * 100) : 0);

export default function ImageConvertTool({ slug, output, accept, matches, defaultQuality = 0.9, dropLabel, dropHint, svg = false }: ImageConvertToolProps) {
  useTrackTool(slug);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [quality, setQuality] = React.useState(defaultQuality);
  const [background, setBackground] = React.useState("#ffffff");
  const [svgWidth, setSvgWidth] = React.useState(DEFAULT_SVG_WIDTH);
  const [resize, setResize] = React.useState(false);
  const [maxWidth, setMaxWidth] = React.useState(1920);
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

  const makeUrl = (blob: Blob) => {
    const u = URL.createObjectURL(blob);
    urlsRef.current.add(u);
    return u;
  };
  const dropUrl = (u?: string) => {
    if (!u) return;
    URL.revokeObjectURL(u);
    urlsRef.current.delete(u);
  };

  const handleFiles = async (files: File[]) => {
    const items: QueueItem[] = await Promise.all(
      files.filter(matches).map(async (file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending" as const,
        aspectRatio: svg ? await readSvgAspectRatio(file).catch(() => 1) : 1,
        thumbUrl: makeUrl(file),
      }))
    );
    if (items.length === 0) return;
    setQueue((prev) => [...prev, ...items]);
    setSelectedId((cur) => cur ?? items[0].id);
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>.
  useIncomingHandoff((file) => void handleFiles([file]));

  const removeItem = (id: string) => {
    const item = queue.find((q) => q.id === id);
    if (item) [item.thumbUrl, item.originalUrl, item.processedUrl].forEach(dropUrl);
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const settingsKey = JSON.stringify([output, quality, background, svgWidth, resize, maxWidth]);

  const process = React.useCallback(
    async (item: QueueItem): Promise<Partial<QueueItem>> => {
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
        const worker = workerRef.current;
        if (!worker) throw new Error("Converter not ready");
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
      if (result.status !== "success") throw new Error(result.message);
      dropUrl(item.processedUrl);
      return {
        resultBlob: result.blob,
        resultName: result.fileName,
        processedUrl: makeUrl(result.blob),
        // An SVG "original" is a vector: only raster sources get a before/after slider.
        originalUrl: svg ? undefined : (item.originalUrl ?? makeUrl(item.file)),
        error: undefined,
      };
    },
    [svg, svgWidth, output, quality, background, resize, maxWidth]
  );

  const { running } = useBatchProcessor({ queue, setQueue, settingsKey, process });

  const done = queue.filter((q) => q.status === "done" && q.resultBlob);
  const before = done.reduce((s, i) => s + i.file.size, 0);
  const after = done.reduce((s, i) => s + (i.resultBlob?.size ?? 0), 0);
  const selected = queue.find((q) => q.id === selectedId) ?? queue[0] ?? null;

  const downloadOne = async (item: QueueItem) => {
    if (!item.resultBlob || !item.resultName) return;
    downloadBlob(item.resultBlob, item.resultName);
    await saveToolResult(slug, { title: item.resultName, summary: `${item.file.name} → ${formatBytes(item.resultBlob.size)}`, blob: item.resultBlob });
    historyRef.current?.refresh();
  };

  const downloadAllAsZip = async () => {
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

  const stage = !selected ? null : selected.status === "error" ? (
    <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {selected.file.name}: {selected.error}
    </p>
  ) : selected.processedUrl && selected.resultBlob && selected.originalUrl ? (
    <div className="h-full w-full">
      <ImageComparisonSlider
        fill
        originalUrl={selected.originalUrl}
        processedUrl={selected.processedUrl}
        originalLabel={`Original: ${formatBytes(selected.file.size)}`}
        processedLabel={`${label}: ${formatBytes(selected.resultBlob.size)}`}
      />
    </div>
  ) : selected.processedUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={selected.processedUrl} alt={`${selected.resultName} preview`} className="max-h-full max-w-full object-contain" />
  ) : (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Converting…
    </div>
  );

  const sidebar = (
    <>
      <SidebarSection title="Summary">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium">
            {done.length} of {queue.length} converted to {label}
            {running && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-primary" />}
          </p>
          {done.length > 0 && (
            <p className="mt-1 text-muted-foreground" role="status">
              {formatBytes(before)} → <span className="font-medium text-foreground">{formatBytes(after)}</span>{" "}
              <span className={after <= before ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}>({pct(before, after)}% {after <= before ? "smaller" : "larger"})</span>
            </p>
          )}
        </div>
      </SidebarSection>

      {selected?.resultBlob && (
        <SidebarSection title="Selected file">
          <div className="space-y-1 text-sm">
            <p className="truncate font-medium" title={selected.file.name}>{selected.file.name}</p>
            <p className="text-muted-foreground">
              {formatBytes(selected.file.size)} → {formatBytes(selected.resultBlob.size)} · {pct(selected.file.size, selected.resultBlob.size)}% {selected.resultBlob.size <= selected.file.size ? "smaller" : "larger"}
            </p>
          </div>
        </SidebarSection>
      )}

      <SidebarSection title="Settings">
        <p className="text-xs text-muted-foreground">Changes apply to every file automatically.</p>
        {svg && <SliderRow label="Output width" value={svgWidth} min={16} max={4096} step={16} unit="px" onChange={setSvgWidth} />}
        {output !== "png" ? (
          <SliderRow label="Quality" value={Math.round(quality * 100)} min={40} max={100} step={5} unit="%" onChange={(v) => setQuality(v / 100)} />
        ) : (
          <p className="text-xs text-muted-foreground">PNG is lossless, so there is no quality setting — file size depends on the image itself.</p>
        )}
        {!svg && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={resize} onChange={(e) => setResize(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> Limit the width
            </label>
            {resize && <SliderRow label="Max width" value={maxWidth} min={64} max={8000} step={32} unit="px" onChange={setMaxWidth} />}
          </div>
        )}
        {output === "jpeg" && (
          <div className="space-y-1.5" role="group" aria-label="Background colour">
            <p className="text-sm font-medium">Background</p>
            <div className="flex flex-wrap items-center gap-2">
              {BACKGROUNDS.map((b) => (
                <button key={b.value} onClick={() => setBackground(b.value)} aria-pressed={background === b.value} title={b.label} aria-label={b.label} className={cn("h-7 w-7 rounded-full border-2 transition-shadow", background === b.value ? "border-primary ring-2 ring-primary/30" : "border-border")} style={{ backgroundColor: b.value }} />
              ))}
              <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} aria-label="Custom background colour" className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0" />
            </div>
            <p className="text-xs text-muted-foreground">Fills transparent areas (JPG has no transparency).</p>
          </div>
        )}
      </SidebarSection>
    </>
  );

  const footer = (
    <>
      <Button className="flex-1" onClick={downloadAllAsZip} disabled={done.length === 0}>
        <PackageOpen className="h-4 w-4" /> {done.length > 1 ? `Download all (${done.length}) as ZIP` : "Download ZIP"}
      </Button>
      <Button variant="outline" onClick={() => selected && void downloadOne(selected)} disabled={!selected?.resultBlob}>
        <Download className="h-4 w-4" /> This file
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <BatchWorkspace
        items={queue.map((q) => ({ id: q.id, name: q.file.name, size: q.file.size, status: q.status, error: q.error, thumbUrl: q.thumbUrl, resultSize: q.resultBlob?.size }))}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        onRemove={removeItem}
        onFiles={(f) => void handleFiles(f)}
        accept={accept}
        dropLabel={dropLabel}
        dropHint={dropHint}
        stage={stage}
        sidebar={sidebar}
        footer={footer}
      />
      <ToolHistoryList ref={historyRef} toolSlug={slug} />
    </div>
  );
}
