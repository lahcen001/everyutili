"use client";

import * as React from "react";
import { Reorder, useDragControls, type DragControls } from "framer-motion";
import { Download, GripVertical, LayoutGrid, Loader2, Trash2, Upload } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Cell {
  /** Fraction of the canvas, 0-1. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutPreset {
  id: string;
  label: string;
  cells: Cell[];
  /** Width:height aspect ratio of the whole collage canvas. */
  aspect: number;
}

const LAYOUTS: LayoutPreset[] = [
  {
    id: "2x1",
    label: "2 x 1",
    aspect: 4 / 3,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "1x2",
    label: "1 x 2",
    aspect: 3 / 4,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: "2x2",
    label: "2 x 2",
    aspect: 1,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "3x1",
    label: "3 x 1",
    aspect: 16 / 9,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    id: "1x3",
    label: "1 x 3",
    aspect: 9 / 16,
    cells: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
  {
    id: "3x3",
    label: "3 x 3",
    aspect: 1,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
    ],
  },
  {
    id: "big-small",
    label: "1 Big + 2",
    aspect: 4 / 3,
    cells: [
      { x: 0, y: 0, w: 2 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    ],
  },
];

const CANVAS_BASE = 1200;
const OUTPUT_FORMATS = [
  { id: "png", label: "PNG", mime: "image/png" },
  { id: "webp", label: "WebP", mime: "image/webp" },
] as const;

interface CollageImage {
  id: string;
  file: File;
  previewUrl: string;
  img: HTMLImageElement;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function generateId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Draws `img` into the rect at (dx, dy, dw, dh) using object-fit: cover. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const sourceRatio = img.width / img.height;
  const targetRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (sourceRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export default function ImageCollage() {
  useTrackTool("image-collage");

  const [images, setImages] = React.useState<CollageImage[]>([]);
  const [order, setOrder] = React.useState<string[]>([]);
  const [layoutId, setLayoutId] = React.useState<string>(LAYOUTS[2]!.id);
  const [gutter, setGutter] = React.useState(8);
  const [radius, setRadius] = React.useState(8);
  const [bgColor, setBgColor] = React.useState("#ffffff");
  const [format, setFormat] = React.useState<(typeof OUTPUT_FORMATS)[number]["id"]>("png");
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);

  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const previewUrlsRef = React.useRef<Map<string, string>>(new Map());
  const resultUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      for (const url of previewUrls.values()) URL.revokeObjectURL(url);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const layout = React.useMemo(() => LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[2]!, [layoutId]);

  const imagesById = React.useMemo(() => {
    const map = new Map<string, CollageImage>();
    for (const img of images) map.set(img.id, img);
    return map;
  }, [images]);

  const handleFiles = React.useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setError(null);

    try {
      const loaded = await Promise.all(
        imageFiles.map(async (file) => {
          const img = await loadImage(file);
          const previewUrl = img.src;
          const id = generateId();
          previewUrlsRef.current.set(id, previewUrl);
          return { id, file, previewUrl, img };
        })
      );
      setImages((prev) => [...prev, ...loaded]);
      setOrder((prev) => [...prev, ...loaded.map((l) => l.id)]);
    } catch {
      setError("Could not load one or more images.");
    }
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setOrder((prev) => prev.filter((oid) => oid !== id));
    const url = previewUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(id);
    }
  };

  const resetAll = () => {
    for (const url of previewUrlsRef.current.values()) URL.revokeObjectURL(url);
    previewUrlsRef.current.clear();
    setImages([]);
    setOrder([]);
    setResultBlob(null);
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
      setResultUrl(null);
    }
  };

  const renderCollage = React.useCallback(
    (canvas: HTMLCanvasElement) => {
      const width = CANVAS_BASE;
      const height = Math.round(CANVAS_BASE / layout.aspect);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      const cellCount = layout.cells.length;
      const orderedIds = order.slice(0, cellCount);

      layout.cells.forEach((cell, i) => {
        const id = orderedIds[i];
        const entry = id ? imagesById.get(id) : undefined;

        const x = cell.x * width + gutter / 2;
        const y = cell.y * height + gutter / 2;
        const w = cell.w * width - gutter;
        const h = cell.h * height - gutter;
        if (w <= 0 || h <= 0) return;

        ctx.save();
        drawRoundedRectPath(ctx, x, y, w, h, radius);
        ctx.clip();

        if (entry) {
          drawCover(ctx, entry.img, x, y, w, h);
        } else {
          ctx.fillStyle = "#e5e7eb";
          ctx.fillRect(x, y, w, h);
        }

        ctx.restore();
      });
    },
    [layout, order, imagesById, gutter, radius, bgColor]
  );

  // Live preview redraw whenever inputs change.
  React.useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || images.length === 0) return;
    renderCollage(canvas);
  }, [renderCollage, images.length]);

  const handleExport = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || images.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      renderCollage(canvas);
      const mimeType = OUTPUT_FORMATS.find((f) => f.id === format)?.mime ?? "image/png";
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, 0.92));
      if (!blob) throw new Error("Export failed");

      const url = URL.createObjectURL(blob);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = url;
      setResultUrl(url);
      setResultBlob(blob);

      const fileName = `collage-${Date.now()}.${format}`;
      await saveToolResult("image-collage", {
        title: fileName,
        summary: `${layout.label} · ${images.length} photos · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch {
      setError("Could not export the collage. Try fewer or smaller images.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    downloadBlob(resultBlob, `collage-${Date.now()}.${format}`);
  };

  const cellCount = layout.cells.length;
  const usedCount = Math.min(order.length, cellCount);

  return (
    <div className="space-y-6">
      {images.length === 0 && (
        <DropZone
          onFiles={handleFiles}
          accept="image/*"
          multiple={true}
          label="Drag & drop photos here, or click to browse"
          hint="Choose several photos — arranged entirely in your browser"
        />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {images.length > 0 && (
        <>
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {images.length} photo{images.length === 1 ? "" : "s"} · using {usedCount} of {cellCount} cells
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.multiple = true;
                    input.onchange = () => {
                      if (input.files) void handleFiles(Array.from(input.files));
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-3.5 w-3.5" /> Add photos
                </Button>
                <Button size="sm" variant="outline" onClick={resetAll}>
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Reorder photos (fills cells in order)</p>
              <Reorder.Group
                axis="y"
                values={order}
                onReorder={setOrder}
                className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2"
              >
                {order.map((id, index) => {
                  const entry = imagesById.get(id);
                  if (!entry) return null;
                  return (
                    <ReorderRow
                      key={id}
                      id={id}
                      index={index}
                      inUse={index < cellCount}
                      entry={entry}
                      onRemove={() => removeImage(id)}
                    />
                  );
                })}
              </Reorder.Group>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Layout</p>
              <div className="flex flex-wrap gap-2">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLayoutId(l.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      layoutId === l.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="space-y-1 text-xs">
                <span className="flex justify-between text-muted-foreground">
                  <span>Spacing</span>
                  <span>{gutter}px</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={32}
                  step={1}
                  value={gutter}
                  onChange={(e) => setGutter(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="flex justify-between text-muted-foreground">
                  <span>Corner radius</span>
                  <span>{radius}px</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Background color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <span className="font-mono text-xs text-muted-foreground">{bgColor}</span>
                </div>
              </label>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
              <canvas ref={previewCanvasRef} className="w-full" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                {OUTPUT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      format === f.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <Button size="sm" className="ml-auto" onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering…
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5" /> Create collage
                  </>
                )}
              </Button>
            </div>
          </Card>

          {resultUrl && resultBlob && (
            <Card className="space-y-3 p-4">
              <img src={resultUrl} alt="Collage result" className="w-full rounded-lg border border-border" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {layout.label} · {formatBytes(resultBlob.size)}
                </p>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="image-collage" />
    </div>
  );
}

interface ReorderRowProps {
  id: string;
  index: number;
  inUse: boolean;
  entry: CollageImage;
  onRemove: () => void;
}

function ReorderRow({ id, index, inUse, entry, onRemove }: ReorderRowProps) {
  const dragControls: DragControls = useDragControls();

  return (
    <Reorder.Item value={id} dragListener={false} dragControls={dragControls} as="div" className="list-none">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
          inUse ? "border-border" : "border-dashed border-border/60 opacity-60"
        )}
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <img src={entry.previewUrl} alt={entry.file.name} className="h-10 w-10 rounded object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{entry.file.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {inUse ? `Cell ${index + 1}` : "Not shown (no cell left)"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
}
