"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, Loader2, Maximize2, PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { SidebarSection, SliderRow } from "@/components/tools/shared/EditorLayout";
import { ImageComparisonSlider } from "@/components/tools/media/ImageComparisonSlider";
import { BatchWorkspace } from "@/components/tools/media/BatchWorkspace";
import { useBatchProcessor, type BatchProcessable } from "@/components/tools/media/useBatchProcessor";
import { ImageDeepInspector, type ImageInspectorItem } from "@/components/shared/inspectors/ImageDeepInspector";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import type { ImageConvertRequest, ImageConvertResponse } from "@/workers/image-converter.worker";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

interface QueueItem extends BatchProcessable {
  file: File;
  thumbUrl: string;
  error?: string;
  resultBlob?: Blob;
  originalUrl?: string;
  processedUrl?: string;
}

const PRESETS = [
  { label: "Small file", quality: 55 },
  { label: "Balanced", quality: 75 },
  { label: "High quality", quality: 90 },
];

const outName = (item: QueueItem) => {
  const base = item.file.name.replace(/\.[^/.]+$/, "");
  return `${base}-compressed.${EXTENSION_BY_MIME[item.resultBlob?.type ?? ""] ?? "jpg"}`;
};
const pct = (orig: number, now: number) => (orig > 0 ? Math.round((1 - now / orig) * 100) : 0);

export default function ImageCompressor() {
  useTrackTool("image-compressor");
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [quality, setQuality] = React.useState(0.75);
  const [pngToJpg, setPngToJpg] = React.useState(true);
  const [limitWidth, setLimitWidth] = React.useState(false);
  const [maxWidth, setMaxWidth] = React.useState(2560);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const urlsRef = React.useRef<Set<string>>(new Set());

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

  const handleFiles = (files: File[]) => {
    const items: QueueItem[] = files
      .filter((f) => f.type.startsWith("image/") && f.type !== "image/svg+xml")
      .map((file) => ({ id: crypto.randomUUID(), file, status: "pending", thumbUrl: makeUrl(file) }));
    if (items.length === 0) return;
    setQueue((prev) => [...prev, ...items]);
    setSelectedId((cur) => cur ?? items[0].id);
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>.
  useIncomingHandoff((file) => handleFiles([file]));

  const removeItem = (id: string) => {
    const item = queue.find((q) => q.id === id);
    if (item) [item.thumbUrl, item.originalUrl, item.processedUrl].forEach(dropUrl);
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const settingsKey = JSON.stringify([quality, pngToJpg, limitWidth, maxWidth]);

  const process = React.useCallback(
    async (item: QueueItem): Promise<Partial<QueueItem>> => {
      const worker = workerRef.current;
      if (!worker) throw new Error("Compressor not ready");
      // PNG is lossless, so quality alone won't shrink it — optionally recompress as JPEG.
      // Every other format keeps its own encoding (JPEG stays JPEG, WebP stays WebP).
      const response = await new Promise<ImageConvertResponse>((resolve) => {
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
          format: item.file.type === "image/png" && pngToJpg ? "jpeg" : "auto",
          quality,
          maxWidth: limitWidth ? maxWidth : null,
        };
        worker.postMessage(request);
      });
      if (response.status === "error") throw new Error(response.message);
      dropUrl(item.processedUrl);
      return {
        resultBlob: response.blob,
        processedUrl: makeUrl(response.blob),
        originalUrl: item.originalUrl ?? makeUrl(item.file),
        error: undefined,
      };
    },
    [quality, pngToJpg, limitWidth, maxWidth]
  );

  const { running } = useBatchProcessor({ queue, setQueue, settingsKey, process });

  const done = queue.filter((q): q is QueueItem & { resultBlob: Blob } => q.status === "done" && !!q.resultBlob);
  const before = done.reduce((s, i) => s + i.file.size, 0);
  const after = done.reduce((s, i) => s + i.resultBlob.size, 0);
  const selected = queue.find((q) => q.id === selectedId) ?? queue[0] ?? null;

  const downloadOne = async (item: QueueItem) => {
    if (!item.resultBlob) return;
    downloadBlob(item.resultBlob, outName(item));
    await saveToolResult("image-compressor", {
      title: outName(item),
      summary: `${item.file.name} → ${formatBytes(item.resultBlob.size)} (${pct(item.file.size, item.resultBlob.size)}% smaller)`,
      blob: item.resultBlob,
    });
    historyRef.current?.refresh();
  };

  const downloadAllAsZip = async () => {
    if (done.length === 0) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const item of done) {
      let name = outName(item);
      for (let n = 2; used.has(name); n++) name = outName(item).replace(/(\.[^.]+)$/, `-${n}$1`);
      used.add(name);
      zip.file(name, item.resultBlob);
    }
    downloadBlob(await zip.generateAsync({ type: "blob" }), "compressed-images.zip");
  };

  const inspectorItems: ImageInspectorItem[] = done
    .filter((i) => i.originalUrl && i.processedUrl)
    .map((i) => ({
      id: i.id,
      name: i.file.name,
      originalUrl: i.originalUrl!,
      processedUrl: i.processedUrl!,
      originalBytes: i.file.size,
      processedBytes: i.resultBlob.size,
      mimeType: i.resultBlob.type,
    }));
  const inspectorIndex = Math.max(0, inspectorItems.findIndex((i) => i.id === selected?.id));

  const stage = !selected ? null : selected.status === "error" ? (
    <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {selected.file.name}: {selected.error}
    </p>
  ) : selected.processedUrl && selected.originalUrl && selected.resultBlob ? (
    <div className="h-full w-full">
      <ImageComparisonSlider
        fill
        originalUrl={selected.originalUrl}
        processedUrl={selected.processedUrl}
        originalLabel={`Original: ${formatBytes(selected.file.size)}`}
        processedLabel={`Compressed: ${formatBytes(selected.resultBlob.size)} (-${pct(selected.file.size, selected.resultBlob.size)}%)`}
      />
    </div>
  ) : (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Compressing…
    </div>
  );

  const sidebar = (
    <>
      <SidebarSection title="Result">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium">
            {done.length} of {queue.length} compressed
            {running && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-primary" />}
          </p>
          {done.length > 0 && (
            <>
              <p className="mt-1 text-muted-foreground" role="status">
                {formatBytes(before)} → <span className="font-medium text-foreground">{formatBytes(after)}</span>
              </p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {Math.max(0, pct(before, after))}% <span className="text-sm font-medium">saved</span>
              </p>
            </>
          )}
        </div>
      </SidebarSection>

      <SidebarSection title="Compression">
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setQuality(p.quality / 100)} aria-pressed={Math.round(quality * 100) === p.quality} className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${Math.round(quality * 100) === p.quality ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <SliderRow label="Quality" value={Math.round(quality * 100)} min={10} max={100} step={5} unit="%" onChange={(v) => setQuality(v / 100)} />
        <p className="text-xs text-muted-foreground">Changes apply to every file automatically — compare with the slider.</p>
      </SidebarSection>

      <SidebarSection title="Options">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={pngToJpg} onChange={(e) => setPngToJpg(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
          <span>
            Convert PNG to JPG
            <span className="block text-xs text-muted-foreground">PNG is lossless, so quality alone barely shrinks it. Turn off to keep transparency.</span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={limitWidth} onChange={(e) => setLimitWidth(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> Limit the width
        </label>
        {limitWidth && <SliderRow label="Max width" value={maxWidth} min={320} max={8000} step={80} unit="px" onChange={setMaxWidth} />}
      </SidebarSection>
    </>
  );

  const footer = (
    <>
      <Button className="flex-1" onClick={downloadAllAsZip} disabled={done.length === 0}>
        <PackageOpen className="h-4 w-4" /> {done.length > 1 ? `Download all (${done.length}) as ZIP` : "Download ZIP"}
      </Button>
      <Button variant="outline" onClick={() => selected && void downloadOne(selected)} disabled={!selected?.resultBlob} aria-label="Download this file">
        <Download className="h-4 w-4" />
      </Button>
      <Button variant="outline" onClick={() => setInspectorOpen(true)} disabled={inspectorItems.length === 0} aria-label="Inspect in full screen">
        <Maximize2 className="h-4 w-4" />
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
        onFiles={handleFiles}
        accept="image/*"
        dropLabel="Drag & drop images here, or click to browse"
        dropHint="Compress JPG, PNG, or WebP images entirely in your browser"
        stage={stage}
        sidebar={sidebar}
        footer={footer}
      />

      <ToolHistoryList ref={historyRef} toolSlug="image-compressor" />

      <ImageDeepInspector
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        items={inspectorItems}
        activeIndex={inspectorIndex}
        onActiveIndexChange={(i) => inspectorItems[i] && setSelectedId(inspectorItems[i].id)}
      />
    </div>
  );
}
