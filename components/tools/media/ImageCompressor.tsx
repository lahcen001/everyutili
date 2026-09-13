"use client";

import * as React from "react";
import { Download, ImageDown, Loader2, Maximize2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { ImageComparisonSlider } from "@/components/tools/media/ImageComparisonSlider";
import {
  ImageDeepInspector,
  type ImageInspectorItem,
} from "@/components/shared/inspectors/ImageDeepInspector";
import type { ImageConvertRequest, ImageConvertResponse } from "@/workers/image-converter.worker";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  resultBlob?: Blob;
  error?: string;
}

interface PreviewUrls {
  originalUrl: string;
  processedUrl: string;
  resultBlob: Blob;
}

export default function ImageCompressor() {
  useTrackTool("image-compressor");
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [quality, setQuality] = React.useState(0.7);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previewUrls, setPreviewUrls] = React.useState<Map<string, PreviewUrls>>(new Map());
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorIndex, setInspectorIndex] = React.useState(0);

  React.useEffect(() => {
    workerRef.current = new Worker(
      new URL("@/workers/image-converter.worker.ts", import.meta.url)
    );
    return () => workerRef.current?.terminate();
  }, []);

  const previewUrlsRef = React.useRef(previewUrls);
  previewUrlsRef.current = previewUrls;

  React.useEffect(() => {
    setPreviewUrls((prev) => {
      const next = new Map(prev);
      let changed = false;

      for (const [id, urls] of prev) {
        const item = queue.find((q) => q.id === id);
        if (!item || item.resultBlob !== urls.resultBlob) {
          URL.revokeObjectURL(urls.originalUrl);
          URL.revokeObjectURL(urls.processedUrl);
          next.delete(id);
          changed = true;
        }
      }

      for (const item of queue) {
        if (item.status === "done" && item.resultBlob && !next.has(item.id)) {
          next.set(item.id, {
            originalUrl: URL.createObjectURL(item.file),
            processedUrl: URL.createObjectURL(item.resultBlob),
            resultBlob: item.resultBlob,
          });
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [queue]);

  React.useEffect(() => {
    return () => {
      for (const urls of previewUrlsRef.current.values()) {
        URL.revokeObjectURL(urls.originalUrl);
        URL.revokeObjectURL(urls.processedUrl);
      }
    };
  }, []);

  const handleFiles = (files: File[]) => {
    const items: QueueItem[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, status: "pending" }));
    setQueue((prev) => [...prev, ...items]);
  };

  // Picks up a "Send to..." handoff from another tool (e.g. Screenshot
  // Beautifier's output opened here via ?from=<id>) and feeds it through
  // the exact same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  const removeItem = (id: string) => setQueue((prev) => prev.filter((item) => item.id !== id));

  const compressAll = async () => {
    const worker = workerRef.current;
    if (!worker) return;
    setIsProcessing(true);
    const pending = queue.filter((item) => item.status !== "done");
    for (const item of pending) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q)));
      try {
        // PNG is lossless, so quality alone won't shrink it — recompress as JPEG.
        // Every other format keeps its own encoding (JPEG stays JPEG, WebP stays WebP).
        const isPng = item.file.type === "image/png";

        const response = await new Promise<ImageConvertResponse>((resolve) => {
          const handleMessage = (event: MessageEvent<ImageConvertResponse>) => {
            if (event.data.id === item.id) {
              worker.removeEventListener("message", handleMessage);
              resolve(event.data);
            }
          };
          worker.addEventListener("message", handleMessage);

          const request: ImageConvertRequest = {
            id: item.id,
            file: item.file,
            format: isPng ? "jpeg" : "auto",
            quality,
            maxWidth: null,
          };
          worker.postMessage(request);
        });

        if (response.status === "error") throw new Error(response.message);
        const blob = response.blob;
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "done", resultBlob: blob } : q))
        );

        const baseName = item.file.name.replace(/\.[^/.]+$/, "");
        const ext = EXTENSION_BY_MIME[blob.type] ?? "jpg";
        await saveToolResult("image-compressor", {
          title: `${baseName}-compressed.${ext}`,
          summary: `${item.file.name} → ${formatBytes(blob.size)} (${Math.round(
            (1 - blob.size / item.file.size) * 100
          )}% smaller)`,
          blob,
        });
        historyRef.current?.refresh();
      } catch (e) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "error", error: e instanceof Error ? e.message : "Failed" }
              : q
          )
        );
      }
    }
    setIsProcessing(false);
  };

  const downloadItem = (item: QueueItem) => {
    if (!item.resultBlob) return;
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    const ext = EXTENSION_BY_MIME[item.resultBlob.type] ?? "jpg";
    downloadBlob(item.resultBlob, `${baseName}-compressed.${ext}`);
  };

  const doneItems = queue.filter(
    (item): item is QueueItem & { resultBlob: Blob } =>
      item.status === "done" && Boolean(item.resultBlob) && previewUrls.has(item.id)
  );

  const inspectorItems: ImageInspectorItem[] = doneItems.map((item) => {
    const preview = previewUrls.get(item.id)!;
    return {
      id: item.id,
      name: item.file.name,
      originalUrl: preview.originalUrl,
      processedUrl: preview.processedUrl,
      originalBytes: item.file.size,
      processedBytes: item.resultBlob.size,
      mimeType: item.resultBlob.type,
    };
  });

  const openInspectorFor = (id: string) => {
    const index = doneItems.findIndex((item) => item.id === id);
    if (index === -1) return;
    setInspectorIndex(index);
    setInspectorOpen(true);
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/*"
        label="Drag & drop images here, or click to browse"
        hint="Compress JPG, PNG, or WebP images entirely in your browser"
      />

      {queue.length > 0 && (
        <>
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Quality</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-32 accent-primary"
              />
              <span className="w-10 text-right text-sm text-muted-foreground">
                {Math.round(quality * 100)}%
              </span>
            </div>
            <Button className="ml-auto" onClick={compressAll} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Compressing…
                </>
              ) : (
                <>
                  <ImageDown className="h-4 w-4" /> Compress all
                </>
              )}
            </Button>
          </Card>

          <div className="grid gap-2">
            {queue.map((item) => {
              const preview = item.resultBlob ? previewUrls.get(item.id) : undefined;
              const percent = item.resultBlob
                ? Math.round((1 - item.resultBlob.size / item.file.size) * 100)
                : 0;

              if (item.status === "done" && item.resultBlob && preview) {
                return (
                  <Card key={item.id} className="space-y-3 p-3">
                    <div className="flex items-center gap-3">
                      <ImageDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(item.file.size)} {" → "}
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {formatBytes(item.resultBlob.size)}
                          </span>{" "}
                          ({percent}% smaller)
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openInspectorFor(item.id)}>
                        <Maximize2 className="h-3.5 w-3.5" /> Compare
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadItem(item)}>
                        <Download className="h-3.5 w-3.5" /> Save
                      </Button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <ImageComparisonSlider
                      originalUrl={preview.originalUrl}
                      processedUrl={preview.processedUrl}
                      originalLabel={`Original: ${formatBytes(item.file.size)}`}
                      processedLabel={`Compressed: ${formatBytes(item.resultBlob.size)} (-${percent}%)`}
                    />
                  </Card>
                );
              }

              return (
                <Card key={item.id} className="flex items-center gap-3 p-3">
                  <ImageDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(item.file.size)}
                      {item.status === "error" && (
                        <span className="ml-2 text-destructive">{item.error}</span>
                      )}
                    </p>
                  </div>
                  {item.status === "processing" && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="image-compressor" />

      <ImageDeepInspector
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        items={inspectorItems}
        activeIndex={inspectorIndex}
        onActiveIndexChange={setInspectorIndex}
      />
    </div>
  );
}
