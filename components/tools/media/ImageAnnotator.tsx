"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Download,
  Eraser,
  Loader2,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
  Hash,
  ImageIcon,
} from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

type Tool = "arrow" | "rectangle" | "text" | "counter" | "pen" | "pixelate";

interface Point {
  x: number;
  y: number;
}

interface BaseShape {
  id: string;
  color: string;
}

interface ArrowShape extends BaseShape {
  type: "arrow";
  from: Point;
  to: Point;
}

interface RectangleShape extends BaseShape {
  type: "rectangle";
  from: Point;
  to: Point;
}

interface TextShape extends BaseShape {
  type: "text";
  at: Point;
  text: string;
}

interface CounterShape extends BaseShape {
  type: "counter";
  at: Point;
  n: number;
}

interface PenShape extends BaseShape {
  type: "pen";
  points: Point[];
}

interface PixelateShape extends BaseShape {
  type: "pixelate";
  from: Point;
  to: Point;
}

type Shape = ArrowShape | RectangleShape | TextShape | CounterShape | PenShape | PixelateShape;

const TOOLS: { value: Tool; label: string; icon: typeof Pencil }[] = [
  { value: "arrow", label: "Arrow", icon: ArrowUpRight },
  { value: "rectangle", label: "Rectangle", icon: Square },
  { value: "text", label: "Text", icon: Type },
  { value: "counter", label: "Counter", icon: Hash },
  { value: "pen", label: "Pen", icon: Pencil },
  { value: "pixelate", label: "Pixelate", icon: Eraser },
];

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#f3f4f6"];
const PIXEL_BLOCK = 14;

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string) {
  const headLength = 14;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawRect(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
}

function drawPen(ctx: CanvasRenderingContext2D, points: Point[], color: string) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function drawCounter(ctx: CanvasRenderingContext2D, at: Point, n: number, color: string) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(at.x, at.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0b0d13";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), at.x, at.y + 1);
}

function drawText(ctx: CanvasRenderingContext2D, at: Point, text: string, color: string) {
  ctx.fillStyle = color;
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, at.x, at.y);
}

/** Pixelates the region of `source` bounded by from/to directly onto ctx (destructive to the base image layer beneath annotations). */
function drawPixelate(ctx: CanvasRenderingContext2D, source: HTMLImageElement | HTMLCanvasElement, from: Point, to: Point) {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  if (w < 1 || h < 1) return;

  const off = document.createElement("canvas");
  const smallW = Math.max(1, Math.round(w / PIXEL_BLOCK));
  const smallH = Math.max(1, Math.round(h / PIXEL_BLOCK));
  off.width = smallW;
  off.height = smallH;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(source, x, y, w, h, 0, 0, smallW, smallH);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, smallW, smallH, x, y, w, h);
  ctx.restore();
}

export default function ImageAnnotator() {
  useTrackTool("image-annotator");

  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [tool, setTool] = React.useState<Tool>("arrow");
  const [color, setColor] = React.useState(COLORS[0]);
  const [shapes, setShapes] = React.useState<Shape[]>([]);
  const [redoStack, setRedoStack] = React.useState<Shape[]>([]);
  const [counterNext, setCounterNext] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const drawingRef = React.useRef<{ start: Point; live: Point } | null>(null);
  const penPointsRef = React.useRef<Point[]>([]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const imageUrlRef = React.useRef<string | null>(null);
  const [textDraft, setTextDraft] = React.useState<{ at: Point; value: string } | null>(null);

  React.useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const loadFile = React.useCallback((file: File) => {
    setError(null);
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    imageUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setShapes([]);
      setRedoStack([]);
      setCounterNext(1);
    };
    img.onerror = () => setError("Could not load that image.");
    img.src = url;
  }, []);

  const handleFiles = React.useCallback(
    (files: File[]) => {
      const file = files.find((f) => f.type.startsWith("image/"));
      if (file) loadFile(file);
    },
    [loadFile]
  );

  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) loadFile(file);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [loadFile]);

  // Rebuilds the base (image + committed pixelate regions, since pixelation
  // must bake into the pixel data future shapes sample from) + redraws every
  // non-pixelate shape on top. Pixelate shapes are applied in order onto
  // baseCanvas so later arrows/text drawn over a redacted area stay legible.
  const redrawAll = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!baseCanvasRef.current) {
      baseCanvasRef.current = document.createElement("canvas");
    }
    const base = baseCanvasRef.current;
    base.width = image.naturalWidth;
    base.height = image.naturalHeight;
    const baseCtx = base.getContext("2d");
    if (!baseCtx) return;
    baseCtx.drawImage(image, 0, 0);

    for (const shape of shapes) {
      if (shape.type === "pixelate") {
        drawPixelate(baseCtx, image, shape.from, shape.to);
      }
    }

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.drawImage(base, 0, 0);

    for (const shape of shapes) {
      switch (shape.type) {
        case "arrow":
          drawArrow(ctx, shape.from, shape.to, shape.color);
          break;
        case "rectangle":
          drawRect(ctx, shape.from, shape.to, shape.color);
          break;
        case "pen":
          drawPen(ctx, shape.points, shape.color);
          break;
        case "counter":
          drawCounter(ctx, shape.at, shape.n, shape.color);
          break;
        case "text":
          drawText(ctx, shape.at, shape.text, shape.color);
          break;
        // pixelate already baked into base above
      }
    }
  }, [image, shapes]);

  React.useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  // Live preview of the shape currently being drawn, on a transparent overlay above the committed canvas.
  const drawLivePreview = React.useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const drag = drawingRef.current;
    if (tool === "pen" && penPointsRef.current.length > 1) {
      drawPen(ctx, penPointsRef.current, color);
      return;
    }
    if (!drag) return;

    if (tool === "arrow") drawArrow(ctx, drag.start, drag.live, color);
    else if (tool === "rectangle") drawRect(ctx, drag.start, drag.live, color);
    else if (tool === "pixelate") {
      ctx.strokeStyle = color;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(
        Math.min(drag.start.x, drag.live.x),
        Math.min(drag.start.y, drag.live.y),
        Math.abs(drag.live.x - drag.start.x),
        Math.abs(drag.live.y - drag.start.y)
      );
      ctx.setLineDash([]);
    }
  }, [tool, color]);

  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function commitShape(shape: Shape) {
    setShapes((prev) => [...prev, shape]);
    setRedoStack([]);
    if (shape.type === "counter") setCounterNext((n) => n + 1);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!image) return;
    const pt = getCanvasPoint(e);

    if (tool === "counter") {
      commitShape({ id: crypto.randomUUID(), type: "counter", at: pt, n: counterNext, color });
      return;
    }
    if (tool === "text") {
      setTextDraft({ at: pt, value: "" });
      return;
    }
    if (tool === "pen") {
      penPointsRef.current = [pt];
      drawingRef.current = { start: pt, live: pt };
      return;
    }
    drawingRef.current = { start: pt, live: pt };
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const pt = getCanvasPoint(e);
    if (tool === "pen") {
      penPointsRef.current = [...penPointsRef.current, pt];
    } else {
      drawingRef.current = { ...drawingRef.current, live: pt };
    }
    drawLivePreview();
  }

  function handleMouseUp() {
    if (!drawingRef.current) return;
    const { start, live } = drawingRef.current;
    drawingRef.current = null;

    if (tool === "arrow" && (Math.abs(live.x - start.x) > 2 || Math.abs(live.y - start.y) > 2)) {
      commitShape({ id: crypto.randomUUID(), type: "arrow", from: start, to: live, color });
    } else if (tool === "rectangle" && (Math.abs(live.x - start.x) > 2 || Math.abs(live.y - start.y) > 2)) {
      commitShape({ id: crypto.randomUUID(), type: "rectangle", from: start, to: live, color });
    } else if (tool === "pixelate" && (Math.abs(live.x - start.x) > 4 || Math.abs(live.y - start.y) > 4)) {
      commitShape({ id: crypto.randomUUID(), type: "pixelate", from: start, to: live, color });
    } else if (tool === "pen" && penPointsRef.current.length > 1) {
      commitShape({ id: crypto.randomUUID(), type: "pen", points: penPointsRef.current, color });
    }
    penPointsRef.current = [];

    const overlay = overlayCanvasRef.current;
    overlay?.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
  }

  function confirmTextDraft() {
    if (!textDraft || !textDraft.value.trim()) {
      setTextDraft(null);
      return;
    }
    commitShape({ id: crypto.randomUUID(), type: "text", at: textDraft.at, text: textDraft.value, color });
    setTextDraft(null);
  }

  function undo() {
    setShapes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      setRedoStack((r) => [prev[prev.length - 1], ...r]);
      return next;
    });
  }

  function redo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      setShapes((s) => [...s, first]);
      return rest;
    });
  }

  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    setError(null);
    try {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
      if (!blob) throw new Error("Export failed");
      const fileName = `annotated-${Date.now()}.png`;
      downloadBlob(blob, fileName);
      await saveToolResult("image-annotator", {
        title: fileName,
        summary: `${shapes.length} annotation${shapes.length === 1 ? "" : "s"} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch {
      setError("Could not export the image.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!image && (
        <DropZone
          onFiles={handleFiles}
          accept="image/*"
          multiple={false}
          label="Drag & drop an image here, click to browse, or paste with Ctrl+V"
          hint="Arrows, boxes, text, numbered badges, freehand pen, and pixel redaction"
        />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {image && (
        <>
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <div className="flex items-center gap-1 overflow-hidden rounded-lg border border-border">
              {TOOLS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTool(t.value)}
                  title={t.label}
                  aria-label={t.label}
                  className={`flex h-9 w-9 items-center justify-center transition-colors ${
                    tool === t.value ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c ? "border-primary" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={undo} disabled={shapes.length === 0}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={redo} disabled={redoStack.length === 0}>
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImage(null)}>
                <ImageIcon className="h-3.5 w-3.5" /> New
              </Button>
              <Button size="sm" onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Export
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-0">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="block w-full cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 block w-full" />
              {textDraft && (
                <input
                  autoFocus
                  value={textDraft.value}
                  onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                  onBlur={confirmTextDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmTextDraft();
                    if (e.key === "Escape") setTextDraft(null);
                  }}
                  className="absolute z-10 rounded border border-primary bg-card px-2 py-1 text-sm font-semibold outline-none"
                  style={{
                    left: `${(textDraft.at.x / image.naturalWidth) * 100}%`,
                    top: `${(textDraft.at.y / image.naturalHeight) * 100}%`,
                    color,
                  }}
                  placeholder="Type…"
                />
              )}
            </div>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="image-annotator" />
    </div>
  );
}
