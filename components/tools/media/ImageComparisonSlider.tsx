"use client";

import * as React from "react";
import { ArrowLeftRight, Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import { cn } from "@/lib/utils";

type ZoomLevel = 1 | 2 | "fit";

interface ImageComparisonSliderProps {
  originalUrl: string;
  processedUrl: string;
  originalLabel?: string;
  processedLabel?: string;
  className?: string;
}

const ZOOM_STEPS: { value: ZoomLevel; label: string }[] = [
  { value: "fit", label: "Fit" },
  { value: 1, label: "100%" },
  { value: 2, label: "200%" },
];

export function ImageComparisonSlider({
  originalUrl,
  processedUrl,
  originalLabel,
  processedLabel,
  className,
}: ImageComparisonSliderProps) {
  const [position, setPosition] = React.useState(50);
  const [zoom, setZoom] = React.useState<ZoomLevel>("fit");
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

  const scale = zoom === "fit" ? 1 : zoom;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {ZOOM_STEPS.map((step) => (
            <button
              key={step.value}
              type="button"
              onClick={() => setZoom(step.value)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                zoom === step.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-pressed={zoom === step.value}
            >
              {step.value === "fit" && <Maximize2 className="h-3 w-3" />}
              {step.value === 1 && <ZoomOut className="h-3 w-3" />}
              {step.value === 2 && <ZoomIn className="h-3 w-3" />}
              {step.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative aspect-video w-full select-none overflow-hidden rounded-lg border border-border bg-muted/30 touch-none"
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        >
          <img
            src={originalUrl}
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
              src={processedUrl}
              alt="Processed"
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
        </div>

        {originalLabel && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {originalLabel}
          </span>
        )}
        {processedLabel && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {processedLabel}
          </span>
        )}

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
      </div>
    </div>
  );
}
