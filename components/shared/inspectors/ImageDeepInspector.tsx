"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";

export interface ImageInspectorItem {
  id: string;
  name: string;
  originalUrl: string;
  processedUrl: string;
  originalBytes: number;
  processedBytes: number;
  /** Natural pixel dimensions of the processed (output) image, if known. */
  width?: number;
  height?: number;
  mimeType?: string;
}

interface ImageDeepInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ImageInspectorItem[];
  /** Index into `items` to open on. */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

type ZoomLevel = "fit" | 1 | 2;
const ZOOM_STEPS: { value: ZoomLevel; label: string }[] = [
  { value: "fit", label: "Fit" },
  { value: 1, label: "100%" },
  { value: 2, label: "200%" },
];

const LOUPE_SIZE = 160;
const LOUPE_MIN = 2;
const LOUPE_MAX = 8;

function aspectRatioLabel(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  return `${width / divisor}:${height / divisor}`;
}

export function ImageDeepInspector({
  open,
  onOpenChange,
  items,
  activeIndex,
  onActiveIndexChange,
}: ImageDeepInspectorProps) {
  const [zoom, setZoom] = React.useState<ZoomLevel>("fit");
  const [loupeActive, setLoupeActive] = React.useState(false);
  const [loupeStrength, setLoupeStrength] = React.useState(4);

  const item = items[activeIndex] as ImageInspectorItem | undefined;

  const goPrev = React.useCallback(() => {
    onActiveIndexChange(activeIndex > 0 ? activeIndex - 1 : items.length - 1);
  }, [activeIndex, items.length, onActiveIndexChange]);

  const goNext = React.useCallback(() => {
    onActiveIndexChange(activeIndex < items.length - 1 ? activeIndex + 1 : 0);
  }, [activeIndex, items.length, onActiveIndexChange]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && items.length > 1) goPrev();
      if (e.key === "ArrowRight" && items.length > 1) goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, items.length, goPrev, goNext]);

  if (!item) return null;

  const savingsPercent =
    item.originalBytes > 0
      ? Math.round((1 - item.processedBytes / item.originalBytes) * 100)
      : 0;
  const isSmaller = item.processedBytes < item.originalBytes;
  const aspect = aspectRatioLabel(item.width, item.height);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-full max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]">
        <DialogTitle className="sr-only">Inspecting {item.name}</DialogTitle>

        <div className="flex items-center justify-between gap-3 border-b border-border py-3 pl-4 pr-14">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            {items.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Image {activeIndex + 1} of {items.length}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {ZOOM_STEPS.map((step) => (
              <button
                key={step.value}
                type="button"
                onClick={() => setZoom(step.value)}
                aria-pressed={zoom === step.value}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  zoom === step.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {step.value === "fit" && <Maximize2 className="h-3 w-3" />}
                {step.value === 1 && <ZoomOut className="h-3 w-3" />}
                {step.value === 2 && <ZoomIn className="h-3 w-3" />}
                {step.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLoupeActive((v) => !v)}
            aria-pressed={loupeActive}
            title="Toggle magnifier loupe"
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              loupeActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            Loupe
          </button>
        </div>

        {/* Metadata HUD strip */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            {formatBytes(item.originalBytes)}
            <span className="mx-1 text-muted-foreground/50">→</span>
            <span className="font-medium text-foreground">{formatBytes(item.processedBytes)}</span>
          </span>
          {item.originalBytes > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                isSmaller
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              )}
            >
              {isSmaller ? "-" : "+"}
              {Math.abs(savingsPercent)}%
            </span>
          )}
          {item.width && item.height && (
            <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {item.width}×{item.height}px
            </span>
          )}
          {aspect && (
            <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {aspect}
            </span>
          )}
          {item.mimeType && (
            <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {item.mimeType}
            </span>
          )}
          {loupeActive && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-muted-foreground">Loupe {loupeStrength}x</span>
              <input
                type="range"
                min={LOUPE_MIN}
                max={LOUPE_MAX}
                step={1}
                value={loupeStrength}
                onChange={(e) => setLoupeStrength(Number(e.target.value))}
                className="w-24 accent-primary"
              />
            </div>
          )}
        </div>

        {/* Comparison canvas — keyed by item.id so slider/loupe position
            resets cleanly per image via remount instead of an effect. */}
        <div className="relative flex-1 overflow-hidden bg-muted/10">
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-md hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next image"
                className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-md hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <ComparisonCanvas
            key={item.id}
            item={item}
            zoom={zoom}
            loupeActive={loupeActive}
            loupeStrength={loupeStrength}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ComparisonCanvasProps {
  item: ImageInspectorItem;
  zoom: ZoomLevel;
  loupeActive: boolean;
  loupeStrength: number;
}

function ComparisonCanvas({ item, zoom, loupeActive, loupeStrength }: ComparisonCanvasProps) {
  const [position, setPosition] = React.useState(50);
  const [loupePos, setLoupePos] = React.useState<{ x: number; y: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);

  const updatePositionFromClientX = React.useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }, []);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePositionFromClientX(e.clientX);
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updatePositionFromClientX(e.clientX);
  };
  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!loupeActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setLoupePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const scale = zoom === "fit" ? 1 : zoom;

  return (
    <div
      ref={containerRef}
      onMouseMove={onCanvasMouseMove}
      onMouseLeave={() => setLoupePos(null)}
      className="relative h-full w-full select-none overflow-hidden touch-none"
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
      >
        <img
          src={item.originalUrl}
          alt="Original"
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      </div>

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        >
          <img
            src={item.processedUrl}
            alt="Processed"
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        </div>
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
        Original
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
        Processed
      </span>

      <div
        className="absolute inset-y-0 z-10 flex w-8 -translate-x-1/2 cursor-ew-resize items-center justify-center touch-none"
        style={{ left: `${position}%` }}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        role="slider"
        aria-label="Comparison slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 2));
          if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 2));
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)]" />
        <div className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-full bg-white text-foreground shadow-md">
          <ArrowLeftRight className="h-4 w-4" />
        </div>
      </div>

      {loupeActive && loupePos && (
        <div
          className="pointer-events-none absolute z-30 overflow-hidden rounded-full border-2 border-white shadow-2xl"
          style={{
            width: LOUPE_SIZE,
            height: LOUPE_SIZE,
            left: `calc(${loupePos.x}% - ${LOUPE_SIZE / 2}px)`,
            top: `calc(${loupePos.y}% - ${LOUPE_SIZE / 2}px)`,
            backgroundImage: `url(${loupePos.x < position ? item.originalUrl : item.processedUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${loupeStrength * 100}%`,
            backgroundPosition: `${loupePos.x}% ${loupePos.y}%`,
          }}
        />
      )}
    </div>
  );
}
