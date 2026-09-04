"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, FileImage, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { ImageComparisonSlider } from "@/components/tools/media/ImageComparisonSlider";
import type {
  ImageConvertRequest,
  ImageConvertResponse,
} from "@/workers/image-converter.worker";

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  resultBlob?: Blob;
  resultName?: string;
  error?: string;
}

interface PreviewUrls {
  originalUrl: string;
  processedUrl: string;
  resultBlob: Blob;
}

export default function PngToWebp() {
  useTrackTool("png-to-webp");
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [quality, setQuality] = React.useState(0.85);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previewUrls, setPreviewUrls] = React.useState<Map<string, PreviewUrls>>(new Map());
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  React.useEffect(() => {
    workerRef.current = new Worker(
      new URL("@/workers/image-converter.worker.ts", import.meta.url)
    );
    return () => workerRef.current?.terminate();
  }, []);

  const previewUrlsRef = React.useRef(previewUrls);

  const doneKey = React.useMemo(
    () =>
      queue
        .filter((item) => item.status === "done" && item.resultBlob)
        .map((item) => item.id)
        .join(","),
    [queue]
  );

  React.useEffect(() => {
    const next = new Map(previewUrlsRef.current);
    let changed = false;

    for (const [id, urls] of previewUrlsRef.current) {
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

    if (changed) {
      previewUrlsRef.current = next;
      setPreviewUrls(next);
    }
  }, [doneKey, queue]);

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
      .filter((f) => f.type === "image/png")
      .map((file) => ({ id: crypto.randomUUID(), file, status: "pending" }));
    setQueue((prev) => [...prev, ...items]);
  };

  const removeItem = (id: string) => setQueue((prev) => prev.filter((item) => item.id !== id));

  const convertAll = async () => {
    const worker = workerRef.current;
    if (!worker || queue.length === 0) return;
    setIsProcessing(true);

    const pending = queue.filter((item) => item.status === "pending" || item.status === "error");

    for (const item of pending) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q)));

      const result = await new Promise<ImageConvertResponse>((resolve) => {
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
          format: "webp",
          quality,
          maxWidth: null,
        };
        worker.postMessage(request);
      });

      setQueue((prev) =>
        prev.map((q) => {
          if (q.id !== item.id) return q;
          if (result.status === "success") {
            return { ...q, status: "done", resultBlob: result.blob, resultName: result.fileName };
          }
          return { ...q, status: "error", error: result.message };
        })
      );

      if (result.status === "success") {
        await saveToolResult("png-to-webp", {
          title: result.fileName,
          summary: `${item.file.name} → ${formatBytes(result.blob.size)}`,
          blob: result.blob,
        });
        historyRef.current?.refresh();
      }
    }

    setIsProcessing(false);
  };

  const downloadAllAsZip = async () => {
    const done = queue.filter((item) => item.status === "done" && item.resultBlob);
    if (done.length === 0) return;
    const zip = new JSZip();
    done.forEach((item) => {
      if (item.resultBlob && item.resultName) zip.file(item.resultName, item.resultBlob);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "converted-webp.zip");
  };

  const doneCount = queue.filter((item) => item.status === "done").length;
  const totalCount = queue.length;
  const progressPct = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/png"
        label="Drag & drop PNG images here, or click to browse"
        hint="Batch convert to WebP — smaller files, transparency preserved"
      />

      {queue.length > 0 && (
        <>
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Quality</span>
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-24 accent-primary"
              />
              <span className="w-10 text-right text-sm text-muted-foreground">
                {Math.round(quality * 100)}%
              </span>
            </div>

            <div className="ml-auto flex gap-2">
              <Button onClick={convertAll} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Converting…
                  </>
                ) : (
                  "Convert all"
                )}
              </Button>
              {doneCount > 0 && (
                <Button variant="outline" onClick={downloadAllAsZip}>
                  <Download className="h-4 w-4" /> Download ZIP ({doneCount})
                </Button>
              )}
            </div>
          </Card>

          {totalCount > 0 && <Progress value={progressPct} aria-label="Conversion progress" />}

          <div className="grid gap-2">
            {queue.map((item) => {
              const preview = item.resultBlob ? previewUrls.get(item.id) : undefined;

              if (item.status === "done" && item.resultBlob && item.resultName && preview) {
                const percent = Math.round((1 - item.resultBlob.size / item.file.size) * 100);
                const changeLabel = percent >= 0 ? `-${percent}%` : `+${-percent}%`;

                return (
                  <Card key={item.id} className="space-y-3 p-3">
                    <div className="flex items-center gap-3">
                      <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(item.file.size)} {" → "}
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {formatBytes(item.resultBlob.size)}
                          </span>{" "}
                          ({percent >= 0 ? `${percent}% smaller` : `${-percent}% larger`})
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadBlob(item.resultBlob!, item.resultName!)}
                      >
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
                      processedLabel={`WebP: ${formatBytes(item.resultBlob.size)} (${changeLabel})`}
                    />
                  </Card>
                );
              }

              return (
                <Card key={item.id} className="flex items-center gap-3 p-3">
                  <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" />
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

      <ToolHistoryList ref={historyRef} toolSlug="png-to-webp" />
    </div>
  );
}
