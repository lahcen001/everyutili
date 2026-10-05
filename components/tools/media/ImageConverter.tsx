"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, FileImage, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/useAppStore";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import type {
  ImageConvertRequest,
  ImageConvertResponse,
  ImageOutputFormat,
} from "@/workers/image-converter.worker";

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  resultBlob?: Blob;
  resultName?: string;
  error?: string;
}

const FORMATS: { value: ImageOutputFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

export default function ImageConverter() {
  const preset = useAppStore((s) => s.imageConverterPreset);
  const setPreset = useAppStore((s) => s.setImageConverterPreset);
  useTrackTool("jpg-to-png");

  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [background, setBackground] = React.useState("#ffffff");
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  React.useEffect(() => {
    workerRef.current = new Worker(
      new URL("@/workers/image-converter.worker.ts", import.meta.url)
    );
    return () => workerRef.current?.terminate();
  }, []);

  const handleFiles = (files: File[]) => {
    const items: QueueItem[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, status: "pending" }));
    setQueue((prev) => [...prev, ...items]);
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const convertAll = async () => {
    const worker = workerRef.current;
    if (!worker || queue.length === 0) return;
    setIsProcessing(true);

    const pending = queue.filter((item) => item.status === "pending" || item.status === "error");

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q))
      );

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
          format: preset.format,
          quality: preset.quality,
          maxWidth: preset.maxWidth,
          background,
        };
        worker.postMessage(request);
      });

      setQueue((prev) =>
        prev.map((q) => {
          if (q.id !== item.id) return q;
          if (result.status === "success") {
            return { ...q, status: "done", resultBlob: result.blob, resultName: result.fileName };
          }
          return { ...q, status: "error", error: /\.hei[cf]$/i.test(q.file.name) ? "HEIC isn't supported here — use the HEIC to JPG tool first." : result.message };
        })
      );

      if (result.status === "success") {
        await saveToolResult("jpg-to-png", {
          title: result.fileName,
          summary: `${item.file.name} → ${formatBytes(result.blob.size)}`,
          blob: result.blob,
        });
        historyRef.current?.refresh();
      }
    }

    setIsProcessing(false);
  };

  const downloadSingle = (item: QueueItem) => {
    if (!item.resultBlob || !item.resultName) return;
    const url = URL.createObjectURL(item.resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.resultName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async () => {
    const done = queue.filter((item) => item.status === "done" && item.resultBlob);
    if (done.length === 0) return;

    const zip = new JSZip();
    done.forEach((item) => {
      if (item.resultBlob && item.resultName) {
        zip.file(item.resultName, item.resultBlob);
      }
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted-images.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = queue.filter((item) => item.status === "done").length;
  const totalCount = queue.length;
  const progressPct = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/*"
        label="Drag & drop images here, or click to browse"
        hint="Batch conversion supported — no file limit"
      />

      {queue.length > 0 && (
        <>
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Output format</span>
              <div className="flex overflow-hidden rounded-lg border border-border">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setPreset({ format: f.value })}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      preset.format === f.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent hover:bg-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {preset.format !== "png" && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Quality</span>
                <input
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.05}
                  value={preset.quality}
                  onChange={(e) => setPreset({ quality: Number(e.target.value) })}
                  className="w-24 accent-primary"
                />
                <span className="w-10 text-right text-sm text-muted-foreground">
                  {Math.round(preset.quality * 100)}%
                </span>
              </div>
            )}

            {preset.format === "jpeg" && (
              <label className="flex items-center gap-2 text-sm">
                <span className="font-medium">Background</span>
                <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} aria-label="Background colour for transparent areas" className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0" />
                <span className="text-xs text-muted-foreground">fills transparent areas</span>
              </label>
            )}
            {preset.format === "png" && <p className="text-xs text-muted-foreground">PNG is lossless — there is no quality setting.</p>}

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

          {totalCount > 0 && (
            <Progress value={progressPct} aria-label="Conversion progress" />
          )}

          <div className="grid gap-2">
            {queue.map((item) => (
              <Card key={item.id} className="flex items-center gap-3 p-3">
                <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                    {item.resultBlob && ` → ${formatBytes(item.resultBlob.size)} (${item.resultBlob.size <= item.file.size ? "" : "+"}${Math.round(((item.resultBlob.size - item.file.size) / Math.max(item.file.size, 1)) * 100)}%)`}
                    {item.status === "error" && (
                      <span className="ml-2 text-destructive">{item.error}</span>
                    )}
                  </p>
                </div>
                {item.status === "processing" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                )}
                {item.status === "done" && (
                  <Button size="sm" variant="outline" onClick={() => downloadSingle(item)}>
                    <Download className="h-3.5 w-3.5" /> Save
                  </Button>
                )}
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
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="jpg-to-png" />
    </div>
  );
}
