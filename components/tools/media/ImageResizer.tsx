"use client";

import * as React from "react";
import { Download, Loader2, Maximize, Percent, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import type { ImageConvertRequest, ImageConvertResponse } from "@/workers/image-converter.worker";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

interface QueueItem {
  id: string;
  file: File;
  width: number;
  height: number;
  status: "pending" | "processing" | "done" | "error";
  resultBlob?: Blob;
  error?: string;
}

interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PreviewImage {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
}

type DragMode =
  | { kind: "move"; startX: number; startY: number; origin: BoxRect }
  | { kind: "resize"; handle: string; startX: number; startY: number; origin: BoxRect };

const HANDLES = ["nw", "ne", "sw", "se"] as const;

const ASPECT_PRESETS: { label: string; ratio: number | null }[] = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "9:16", ratio: 9 / 16 },
];

function clampRect(rect: BoxRect, bounds: { width: number; height: number }): BoxRect {
  const width = Math.min(Math.max(rect.width, 1), bounds.width);
  const height = Math.min(Math.max(rect.height, 1), bounds.height);
  const x = Math.min(Math.max(rect.x, 0), bounds.width - width);
  const y = Math.min(Math.max(rect.y, 0), bounds.height - height);
  return { x, y, width, height };
}

function centeredBoxForRatio(
  bounds: { width: number; height: number },
  ratio: number | null
): BoxRect {
  if (ratio === null) {
    return clampRect(
      { x: bounds.width * 0.1, y: bounds.height * 0.1, width: bounds.width * 0.8, height: bounds.height * 0.8 },
      bounds
    );
  }
  let width = bounds.width * 0.8;
  let height = width / ratio;
  if (height > bounds.height * 0.8) {
    height = bounds.height * 0.8;
    width = height * ratio;
  }
  const x = (bounds.width - width) / 2;
  const y = (bounds.height - height) / 2;
  return clampRect({ x, y, width, height }, bounds);
}

export default function ImageResizer() {
  useTrackTool("image-resizer");
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [targetWidth, setTargetWidth] = React.useState(800);
  const [targetHeight, setTargetHeight] = React.useState(600);
  const [lockAspect, setLockAspect] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewImage | null>(null);
  const [box, setBox] = React.useState<BoxRect | null>(null);
  const [activeRatio, setActiveRatio] = React.useState<number | null>(null);
  const [unit, setUnit] = React.useState<"px" | "%">("px");
  const [displayScale, setDisplayScale] = React.useState(1);
  const dragRef = React.useRef<DragMode | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    workerRef.current = new Worker(
      new URL("@/workers/image-converter.worker.ts", import.meta.url)
    );
    return () => {
      workerRef.current?.terminate();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    if (queue.length === 0) {
      const bitmap = await createImageBitmap(imageFiles[0]);
      const naturalWidth = bitmap.width;
      const naturalHeight = bitmap.height;
      bitmap.close();
      setTargetWidth(naturalWidth);
      setTargetHeight(naturalHeight);
      const url = URL.createObjectURL(imageFiles[0]);
      previewUrlRef.current = url;
      setPreview({ url, naturalWidth, naturalHeight });
      setBox({ x: 0, y: 0, width: naturalWidth, height: naturalHeight });
      setActiveRatio(null);
    }

    const items: QueueItem[] = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      width: targetWidth,
      height: targetHeight,
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...items]);
  };

  const removeItem = (id: string) => setQueue((prev) => prev.filter((item) => item.id !== id));

  const applyTargetSize = (width: number, height: number) => {
    setTargetWidth(width);
    setTargetHeight(height);
  };

  const handleWidthChange = (value: number) => {
    const width = unit === "%" && preview ? Math.round((value / 100) * preview.naturalWidth) : value;
    let height = targetHeight;
    if (lockAspect && targetWidth > 0) {
      const ratio = targetHeight / targetWidth;
      height = Math.round(width * ratio);
    }
    applyTargetSize(width, height);
    if (preview) {
      const bounds = { width: preview.naturalWidth, height: preview.naturalHeight };
      setBox((prev) => (prev ? clampRect({ ...prev, width, height }, bounds) : prev));
    }
  };

  const handleHeightChange = (value: number) => {
    const height = unit === "%" && preview ? Math.round((value / 100) * preview.naturalHeight) : value;
    let width = targetWidth;
    if (lockAspect && targetHeight > 0) {
      const ratio = targetWidth / targetHeight;
      width = Math.round(height * ratio);
    }
    applyTargetSize(width, height);
    if (preview) {
      const bounds = { width: preview.naturalWidth, height: preview.naturalHeight };
      setBox((prev) => (prev ? clampRect({ ...prev, width, height }, bounds) : prev));
    }
  };

  const handlePresetClick = (ratio: number | null) => {
    if (!preview) return;
    setActiveRatio(ratio);
    setLockAspect(ratio !== null);
    const bounds = { width: preview.naturalWidth, height: preview.naturalHeight };
    const nextBox = centeredBoxForRatio(bounds, ratio);
    setBox(nextBox);
    applyTargetSize(Math.round(nextBox.width), Math.round(nextBox.height));
  };

  const onBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!box) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, origin: box };
  };

  const onHandlePointerDown = (handle: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!box) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "resize", handle, startX: e.clientX, startY: e.clientY, origin: box };
  };

  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !preview) return;
    const bounds = { width: preview.naturalWidth, height: preview.naturalHeight };

    const dx = (e.clientX - drag.startX) / displayScale;
    const dy = (e.clientY - drag.startY) / displayScale;

    if (drag.kind === "move") {
      const next = clampRect({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy }, bounds);
      setBox(next);
      applyTargetSize(Math.round(next.width), Math.round(next.height));
      return;
    }

    if (drag.kind === "resize") {
      let { x, y, width, height } = drag.origin;
      if (drag.handle.includes("n")) {
        y = drag.origin.y + dy;
        height = drag.origin.height - dy;
      }
      if (drag.handle.includes("s")) {
        height = drag.origin.height + dy;
      }
      if (drag.handle.includes("w")) {
        x = drag.origin.x + dx;
        width = drag.origin.width - dx;
      }
      if (drag.handle.includes("e")) {
        width = drag.origin.width + dx;
      }
      if (activeRatio !== null) {
        height = width / activeRatio;
        if (drag.handle.includes("n")) y = drag.origin.y + drag.origin.height - height;
      }
      const next = clampRect({ x, y, width, height }, bounds);
      setBox(next);
      applyTargetSize(Math.round(next.width), Math.round(next.height));
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const resizeAll = async () => {
    const worker = workerRef.current;
    if (!worker) return;
    setIsProcessing(true);
    const pending = queue.filter((item) => item.status !== "done");
    for (const item of pending) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "processing", width: targetWidth, height: targetHeight } : q
        )
      );
      try {
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
            format: "auto",
            quality: 0.92,
            maxWidth: null,
            exactWidth: targetWidth,
            exactHeight: targetHeight,
          };
          worker.postMessage(request);
        });

        if (response.status === "error") throw new Error(response.message);
        const blob = response.blob;
        setQueue((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, status: "done", resultBlob: blob } : x))
        );

        const baseName = item.file.name.replace(/\.[^/.]+$/, "");
        const ext = EXTENSION_BY_MIME[blob.type] ?? "jpg";
        await saveToolResult("image-resizer", {
          title: `${baseName}-${targetWidth}x${targetHeight}.${ext}`,
          summary: `${item.file.name} → ${targetWidth}×${targetHeight} (${formatBytes(blob.size)})`,
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
    downloadBlob(item.resultBlob, `${baseName}-${item.width}x${item.height}.${ext}`);
  };

  const widthDisplay =
    unit === "%" && preview ? Math.round((targetWidth / preview.naturalWidth) * 100) : targetWidth;
  const heightDisplay =
    unit === "%" && preview ? Math.round((targetHeight / preview.naturalHeight) * 100) : targetHeight;

  const stageWidth = preview ? preview.naturalWidth * displayScale : 0;

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/*"
        label="Drag & drop images here, or click to browse"
        hint="Resize by exact pixel dimensions, with optional aspect ratio lock"
      />

      {queue.length > 0 && (
        <>
          {preview && box && (
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {ASPECT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset.ratio)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeRatio === preset.ratio
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center overflow-hidden rounded-lg border border-border">
                  <button
                    onClick={() => setUnit("px")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      unit === "px" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    px
                  </button>
                  <button
                    onClick={() => setUnit("%")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                      unit === "%" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <Percent className="h-3.5 w-3.5" /> %
                  </button>
                </div>
              </div>

              <div className="overflow-auto">
                <div className="relative mx-auto select-none" style={{ width: stageWidth || "100%", maxWidth: "100%" }}>
                  <PreviewStage
                    preview={preview}
                    onScaleChange={setDisplayScale}
                    stageRef={stageRef}
                    onPointerMove={onStagePointerMove}
                    onPointerUp={endDrag}
                  >
                    <div
                      onPointerDown={onBoxPointerDown}
                      className="absolute cursor-move border-2 border-primary bg-primary/10"
                      style={{
                        left: box.x * displayScale,
                        top: box.y * displayScale,
                        width: box.width * displayScale,
                        height: box.height * displayScale,
                      }}
                    >
                      {HANDLES.map((handle) => (
                        <div
                          key={handle}
                          onPointerDown={onHandlePointerDown(handle)}
                          className="absolute h-3 w-3 rounded-full border-2 border-primary bg-background"
                          style={{
                            cursor: handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize",
                            left: handle.includes("w") ? -6 : undefined,
                            right: handle.includes("e") ? -6 : undefined,
                            top: handle.includes("n") ? -6 : undefined,
                            bottom: handle.includes("s") ? -6 : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </PreviewStage>
                </div>
              </div>
            </Card>
          )}

          <Card className="flex flex-wrap items-end gap-4 p-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Width ({unit})</span>
              <input
                type="number"
                min={1}
                value={widthDisplay}
                onChange={(e) => handleWidthChange(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Height ({unit})</span>
              <input
                type="number"
                min={1}
                value={heightDisplay}
                onChange={(e) => handleHeightChange(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(e) => setLockAspect(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Lock aspect ratio
            </label>
            <Button className="ml-auto" onClick={resizeAll} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Resizing…
                </>
              ) : (
                <>
                  <Maximize className="h-4 w-4" /> Resize all
                </>
              )}
            </Button>
          </Card>

          <div className="grid gap-2">
            {queue.map((item) => (
              <Card key={item.id} className="flex items-center gap-3 p-3">
                <Maximize className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                    {item.status === "done" && ` → resized to ${item.width}×${item.height}`}
                    {item.status === "error" && (
                      <span className="ml-2 text-destructive">{item.error}</span>
                    )}
                  </p>
                </div>
                {item.status === "processing" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                )}
                {item.status === "done" && (
                  <Button size="sm" variant="outline" onClick={() => downloadItem(item)}>
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

      <ToolHistoryList ref={historyRef} toolSlug="image-resizer" />
    </div>
  );
}

interface PreviewStageProps {
  preview: PreviewImage;
  onScaleChange: (scale: number) => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  children: React.ReactNode;
}

/**
 * Measures the available container width so the image is displayed at a
 * scale that fits, and reports that scale up so box-rect math (done in
 * natural-image coordinates) can convert to/from displayed pixels.
 */
function PreviewStage({
  preview,
  onScaleChange,
  stageRef,
  onPointerMove,
  onPointerUp,
  children,
}: PreviewStageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = React.useMemo(() => {
    if (containerWidth <= 0) return 1;
    return Math.min(1, containerWidth / preview.naturalWidth);
  }, [containerWidth, preview.naturalWidth]);

  React.useEffect(() => {
    onScaleChange(scale);
  }, [scale, onScaleChange]);

  return (
    <div ref={containerRef} className="w-full">
      <div
        ref={stageRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative touch-none"
        style={{ width: preview.naturalWidth * scale, height: preview.naturalHeight * scale }}
      >
        <img
          src={preview.url}
          alt="Uploaded image preview for resizing"
          className="pointer-events-none absolute inset-0 h-full w-full"
          draggable={false}
        />
        {children}
      </div>
    </div>
  );
}
