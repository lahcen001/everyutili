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
  /** Intrinsic aspect ratio (height / width) read from the SVG, used to derive output height from the user's width. */
  aspectRatio: number;
}

const DEFAULT_WIDTH = 512;

/**
 * SVGs often omit width/height (viewBox-only icon exports), which makes
 * createImageBitmap's own default sizing unreliable — so we read the
 * intrinsic size ourselves and always pass an explicit exactWidth/exactHeight
 * to the worker rather than relying on the SVG's own attributes.
 */
async function readSvgAspectRatio(file: File): Promise<number> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;

  const widthAttr = svg.getAttribute("width");
  const heightAttr = svg.getAttribute("height");
  const width = widthAttr ? parseFloat(widthAttr) : null;
  const height = heightAttr ? parseFloat(heightAttr) : null;
  if (width && height && width > 0) return height / width;

  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0) return parts[3] / parts[2];
  }

  return 1;
}

export default function SvgToPng() {
  useTrackTool("svg-to-png");
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  React.useEffect(() => {
    workerRef.current = new Worker(
      new URL("@/workers/image-converter.worker.ts", import.meta.url)
    );
    return () => workerRef.current?.terminate();
  }, []);

  const handleFiles = async (files: File[]) => {
    const svgFiles = files.filter(
      (f) => f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")
    );
    const items = await Promise.all(
      svgFiles.map(async (file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending" as const,
        aspectRatio: await readSvgAspectRatio(file),
      }))
    );
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

      const exactWidth = width;
      const exactHeight = Math.max(1, Math.round(width * item.aspectRatio));

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
          format: "png",
          quality: 1,
          maxWidth: null,
          exactWidth,
          exactHeight,
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
        await saveToolResult("svg-to-png", {
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
    downloadBlob(blob, "converted-png.zip");
  };

  const doneCount = queue.filter((item) => item.status === "done").length;
  const totalCount = queue.length;
  const progressPct = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/svg+xml,.svg"
        label="Drag & drop SVG files here, or click to browse"
        hint="Batch rasterize vector icons and illustrations to PNG"
      />

      {queue.length > 0 && (
        <>
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Output width</span>
              <input
                type="number"
                min={16}
                max={8000}
                step={1}
                value={width}
                onChange={(e) => setWidth(Math.max(16, Math.min(8000, Number(e.target.value) || DEFAULT_WIDTH)))}
                className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground">px (height scales automatically)</span>
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
            {queue.map((item) => (
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
                {item.status === "done" && item.resultBlob && item.resultName && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadBlob(item.resultBlob!, item.resultName!)}
                  >
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

      <ToolHistoryList ref={historyRef} toolSlug="svg-to-png" />
    </div>
  );
}
