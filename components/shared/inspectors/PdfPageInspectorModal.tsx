"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  MoveHorizontal,
  RotateCw,
  Square,
  SquareCheck,
  Trash2,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { renderPageToUrl } from "@/lib/pdf/renderPageToUrl";

const FULL_RES_SCALE = 3;

type FitMode = "width" | "screen" | 1;

export interface PdfPageInspectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfDoc: import("pdfjs-dist").PDFDocumentProxy | null;
  fileName: string;
  /** Page numbers in the user's current order (post-reorder, pre-filtering). */
  order: number[];
  /** Which page in `order` is active. */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  selected: Set<number>;
  rotations: Record<number, number>;
  onToggleSelected: (pageNumber: number) => void;
  onRotate: (pageNumber: number) => void;
  onDelete: (pageNumber: number) => void;
  /** Reuse a grid's already-rendered thumbnails for the filmstrip instead of re-rendering every page at modal-open time. */
  thumbnailUrlByPage?: Map<number, string>;
}

export function PdfPageInspectorModal({
  open,
  onOpenChange,
  pdfDoc,
  fileName,
  order,
  activeIndex,
  onActiveIndexChange,
  selected,
  rotations,
  onToggleSelected,
  onRotate,
  onDelete,
  thumbnailUrlByPage,
}: PdfPageInspectorModalProps) {
  const [fit, setFit] = React.useState<FitMode>("screen");
  const [fullResByPage, setFullResByPage] = React.useState<Map<number, string>>(new Map());
  const [loadingPage, setLoadingPage] = React.useState<number | null>(null);
  const fullResUrlsRef = React.useRef<Map<number, string>>(new Map());
  const renderingRef = React.useRef<Set<number>>(new Set());

  const pageNumber = order[activeIndex] as number | undefined;

  const revokeAllFullRes = React.useCallback(() => {
    for (const url of fullResUrlsRef.current.values()) URL.revokeObjectURL(url);
    fullResUrlsRef.current.clear();
    renderingRef.current.clear();
  }, []);

  // These are one-off high-scale renders this modal owns end to end (not the
  // grid's shared thumbnails) — revoke them as soon as the modal closes,
  // triggered from the event handler rather than an effect watching `open`.
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) {
        revokeAllFullRes();
        setFullResByPage(new Map());
      }
      onOpenChange(next);
    },
    [onOpenChange, revokeAllFullRes]
  );

  const goPrev = React.useCallback(() => {
    onActiveIndexChange(activeIndex > 0 ? activeIndex - 1 : order.length - 1);
  }, [activeIndex, order.length, onActiveIndexChange]);

  const goNext = React.useCallback(() => {
    onActiveIndexChange(activeIndex < order.length - 1 ? activeIndex + 1 : 0);
  }, [activeIndex, order.length, onActiveIndexChange]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && order.length > 1) goPrev();
      if (e.key === "ArrowRight" && order.length > 1) goNext();
      if (e.key === "r" || e.key === "R") {
        if (pageNumber !== undefined) onRotate(pageNumber);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, order.length, goPrev, goNext, onRotate, pageNumber]);

  React.useEffect(() => {
    if (!open || !pdfDoc || pageNumber === undefined) return;
    if (fullResUrlsRef.current.has(pageNumber) || renderingRef.current.has(pageNumber)) return;
    renderingRef.current.add(pageNumber);
    setLoadingPage(pageNumber);
    renderPageToUrl(pdfDoc, pageNumber, FULL_RES_SCALE)
      .then((url) => {
        fullResUrlsRef.current.set(pageNumber, url);
        setFullResByPage((prev) => new Map(prev).set(pageNumber, url));
      })
      .catch(() => {
        renderingRef.current.delete(pageNumber);
      })
      .finally(() => setLoadingPage((p) => (p === pageNumber ? null : p)));
  }, [open, pdfDoc, pageNumber]);

  React.useEffect(() => {
    return () => {
      revokeAllFullRes();
    };
  }, [revokeAllFullRes]);

  if (pageNumber === undefined) return null;

  const currentUrl = fullResByPage.get(pageNumber) ?? thumbnailUrlByPage?.get(pageNumber) ?? null;
  const rotation = rotations[pageNumber] ?? 0;
  const isSelected = selected.has(pageNumber);
  const isLoading = loadingPage === pageNumber && !currentUrl;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[90vh] w-full max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]">
        <DialogTitle className="sr-only">
          Inspecting page {pageNumber} of {fileName}
        </DialogTitle>

        <div className="flex items-center justify-between gap-3 border-b border-border py-3 pl-4 pr-14">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              Page {activeIndex + 1} of {order.length}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setFit("width")}
              aria-pressed={fit === "width"}
              title="Fit to width"
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                fit === "width"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <MoveHorizontal className="h-3 w-3" />
              Width
            </button>
            <button
              type="button"
              onClick={() => setFit("screen")}
              aria-pressed={fit === "screen"}
              title="Fit to screen"
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                fit === "screen"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Maximize2 className="h-3 w-3" />
              Screen
            </button>
            <button
              type="button"
              onClick={() => setFit(1)}
              aria-pressed={fit === 1}
              title="100%"
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                fit === 1
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              100%
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRotate(pageNumber)}
              title="Rotate 90° clockwise"
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Rotate
            </button>
            <button
              type="button"
              onClick={() => onToggleSelected(pageNumber)}
              aria-pressed={isSelected}
              title={isSelected ? "Exclude from output" : "Include in output"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isSelected ? <SquareCheck className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {isSelected ? "Included" : "Excluded"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(pageNumber)}
              title="Delete page"
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto bg-muted/10">
          {order.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous page"
                className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-md hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next page"
                className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-md hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <div className="flex min-h-full items-center justify-center p-6">
            {isLoading ? (
              <div className="flex h-64 w-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentUrl ? (
              <img
                src={currentUrl}
                alt={`Page ${pageNumber}`}
                className={cn(
                  "bg-white shadow-lg",
                  fit === "width" && "w-full max-w-3xl",
                  fit === "screen" && "max-h-full max-w-full object-contain",
                  fit === 1 && "max-w-none"
                )}
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            ) : null}
          </div>
        </div>

        {order.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-border bg-card p-2">
            {order.map((p, i) => {
              const thumbUrl = thumbnailUrlByPage?.get(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onActiveIndexChange(i)}
                  className={cn(
                    "relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-muted transition-colors",
                    i === activeIndex ? "border-primary" : "border-border hover:border-primary/50"
                  )}
                  aria-label={`Jump to page ${p}`}
                  aria-current={i === activeIndex}
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-full w-full object-contain bg-white"
                      style={{ transform: `rotate(${rotations[p] ?? 0}deg)` }}
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-muted" />
                  )}
                  {!selected.has(p) && (
                    <div className="absolute inset-0 bg-background/60" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
