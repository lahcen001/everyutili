"use client";

import * as React from "react";
import { Reorder, useDragControls, type DragControls } from "framer-motion";
import {
  RotateCw,
  ZoomIn,
  Trash2,
  GripVertical,
  CheckSquare,
  Square,
  SquareStack,
  Check,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { renderPageToUrl } from "@/lib/pdf/renderPageToUrl";
import { PdfPageInspectorModal } from "@/components/shared/inspectors/PdfPageInspectorModal";

export interface VisualPdfPageGridState {
  /** Original 1-based page numbers, in the user's current (possibly reordered) order. */
  order: number[];
  /** Subset of `order` the user has selected. */
  selected: Set<number>;
  /** Rotation in degrees (0/90/180/270) keyed by original page number. */
  rotations: Record<number, number>;
}

export interface VisualPdfPageGridHandle {
  getState: () => VisualPdfPageGridState;
  /** Optional bulk-update escape hatch so a parent can apply rotation changes (e.g. "rotate all", "rotate selected") on top of the grid's own per-card rotate button. */
  applyRotations?: (updater: (prev: Record<number, number>) => Record<number, number>) => void;
}

interface VisualPdfPageGridProps {
  file: File;
  /** Fires on every change so a parent can drive simple UI (counts, enabling a button) without polling the ref. */
  onChange?: (state: VisualPdfPageGridState) => void;
}

interface PageEntry {
  pageNumber: number;
  /** An object URL (not a data: URL) — revoked when replaced/removed/unmounted, see thumbnailUrlsRef. */
  thumbnailUrl: string | null;
}

const THUMBNAIL_SCALE = 0.5;

export const VisualPdfPageGrid = React.forwardRef<VisualPdfPageGridHandle, VisualPdfPageGridProps>(
  function VisualPdfPageGrid({ file, onChange }, ref) {
    const [pdfDoc, setPdfDoc] = React.useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
    const [pages, setPages] = React.useState<PageEntry[]>([]);
    const [order, setOrder] = React.useState<number[]>([]);
    const [selected, setSelected] = React.useState<Set<number>>(new Set());
    const [rotations, setRotations] = React.useState<Record<number, number>>({});
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [lastClicked, setLastClicked] = React.useState<number | null>(null);
    const [inspectorOpen, setInspectorOpen] = React.useState(false);
    const [inspectorIndex, setInspectorIndex] = React.useState(0);
    const [activeTouchMenu, setActiveTouchMenu] = React.useState<number | null>(null);

    const renderingRef = React.useRef<Set<number>>(new Set());
    // Every currently-live thumbnail object URL, keyed by page number — the
    // single source of truth for revocation (on re-render with a new file,
    // on a page being removed from the order, and on unmount).
    const thumbnailUrlsRef = React.useRef<Map<number, string>>(new Map());

    function revokeAllThumbnails() {
      for (const url of thumbnailUrlsRef.current.values()) URL.revokeObjectURL(url);
      thumbnailUrlsRef.current.clear();
    }

    React.useEffect(() => {
      let cancelled = false;

      (async () => {
        setIsLoading(true);
        setError(null);
        // A new `file` means the previously rendered thumbnails (if any)
        // belong to a document we're about to discard — revoke them before
        // resetting state, not just on unmount.
        revokeAllThumbnails();
        try {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();

          const bytes = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
          if (cancelled) return;

          const initialOrder = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
          setPdfDoc(pdf);
          setPages(initialOrder.map((pageNumber) => ({ pageNumber, thumbnailUrl: null })));
          setOrder(initialOrder);
          setSelected(new Set());
          setRotations({});
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to read this PDF file.");
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [file]);

    // Unmount-only cleanup, reading via refs so it always sees the latest
    // URLs without needing them in its dependency array (an empty-deps
    // effect whose cleanup closes over stale state would otherwise revoke
    // nothing, or the wrong thing).
    React.useEffect(() => {
      return () => {
        revokeAllThumbnails();
      };
    }, []);

    const requestThumbnail = React.useCallback(
      (pageNumber: number) => {
        if (!pdfDoc || renderingRef.current.has(pageNumber)) return;
        renderingRef.current.add(pageNumber);

        renderPageToUrl(pdfDoc, pageNumber, THUMBNAIL_SCALE)
          .then((url) => {
            thumbnailUrlsRef.current.set(pageNumber, url);
            setPages((prev) =>
              prev.map((p) => (p.pageNumber === pageNumber ? { ...p, thumbnailUrl: url } : p))
            );
          })
          .catch(() => {
            renderingRef.current.delete(pageNumber);
          });
      },
      [pdfDoc]
    );

    const state = React.useMemo<VisualPdfPageGridState>(
      () => ({ order, selected, rotations }),
      [order, selected, rotations]
    );

    React.useImperativeHandle(
      ref,
      () => ({
        getState: () => state,
        applyRotations: (updater) => setRotations(updater),
      }),
      [state]
    );

    React.useEffect(() => {
      onChange?.(state);
    }, [state, onChange]);

    const togglePage = (pageNumber: number, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClicked !== null) {
          const fromIdx = order.indexOf(lastClicked);
          const toIdx = order.indexOf(pageNumber);
          if (fromIdx !== -1 && toIdx !== -1) {
            const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
            for (let i = lo; i <= hi; i++) next.add(order[i]);
            return next;
          }
        }
        if (next.has(pageNumber)) {
          next.delete(pageNumber);
        } else {
          next.add(pageNumber);
        }
        return next;
      });
      setLastClicked(pageNumber);
    };

    const selectAll = () => setSelected(new Set(order));
    const deselectAll = () => setSelected(new Set());
    const invertSelection = () =>
      setSelected((prev) => new Set(order.filter((p) => !prev.has(p))));

    const rotatePage = (pageNumber: number) => {
      setRotations((prev) => ({
        ...prev,
        [pageNumber]: ((prev[pageNumber] ?? 0) + 90) % 360,
      }));
    };

    const deletePageFromOrder = (pageNumber: number) => {
      // A removed page's thumbnail URL has no other owner — revoke it now
      // rather than only on unmount/file-change, or it leaks for the rest
      // of the session every time a page is deleted from the grid.
      const url = thumbnailUrlsRef.current.get(pageNumber);
      if (url) {
        URL.revokeObjectURL(url);
        thumbnailUrlsRef.current.delete(pageNumber);
      }
      setOrder((prev) => prev.filter((p) => p !== pageNumber));
      setPages((prev) => prev.filter((p) => p.pageNumber !== pageNumber));
      setSelected((prev) => {
        if (!prev.has(pageNumber)) return prev;
        const next = new Set(prev);
        next.delete(pageNumber);
        return next;
      });
    };

    const openInspectorFor = (pageNumber: number) => {
      const index = order.indexOf(pageNumber);
      if (index === -1) return;
      setInspectorIndex(index);
      setInspectorOpen(true);
    };

    const inspectorDelete = (pageNumber: number) => {
      deletePageFromOrder(pageNumber);
      setInspectorOpen(false);
    };

    const pagesByNumber = React.useMemo(() => {
      const map = new Map<number, PageEntry>();
      pages.forEach((p) => map.set(p.pageNumber, p));
      return map;
    }, [pages]);

    // Derived from render-safe state (not thumbnailUrlsRef, which the
    // compiler forbids reading during render) for the inspector's filmstrip.
    const thumbnailUrlByPage = React.useMemo(() => {
      const map = new Map<number, string>();
      pages.forEach((p) => {
        if (p.thumbnailUrl) map.set(p.pageNumber, p.thumbnailUrl);
      });
      return map;
    }, [pages]);

    if (error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex h-40 items-center justify-center gap-2 rounded-lg border border-border text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading PDF…
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background p-3">
          <Reorder.Group
            axis="y"
            values={order}
            onReorder={setOrder}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {order.map((pageNumber, index) => (
              <PageCard
                key={pageNumber}
                pageNumber={pageNumber}
                position={index + 1}
                entry={pagesByNumber.get(pageNumber) ?? null}
                isSelected={selected.has(pageNumber)}
                rotation={rotations[pageNumber] ?? 0}
                onToggle={(shiftKey) => togglePage(pageNumber, shiftKey)}
                onRotate={() => rotatePage(pageNumber)}
                onDelete={() => deletePageFromOrder(pageNumber)}
                onPreview={() => openInspectorFor(pageNumber)}
                requestThumbnail={requestThumbnail}
                touchMenuOpen={activeTouchMenu === pageNumber}
                onToggleTouchMenu={() =>
                  setActiveTouchMenu((prev) => (prev === pageNumber ? null : pageNumber))
                }
              />
            ))}
          </Reorder.Group>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <Button size="sm" variant="outline" onClick={selectAll} disabled={order.length === 0}>
            <CheckSquare className="h-3.5 w-3.5" /> Select All
          </Button>
          <Button size="sm" variant="outline" onClick={deselectAll} disabled={selected.size === 0}>
            <Square className="h-3.5 w-3.5" /> Deselect All
          </Button>
          <Button size="sm" variant="outline" onClick={invertSelection} disabled={order.length === 0}>
            <SquareStack className="h-3.5 w-3.5" /> Invert Selection
          </Button>
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {selected.size} of {order.length} pages selected
          </span>
        </div>

        <PdfPageInspectorModal
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
          pdfDoc={pdfDoc}
          fileName={file.name}
          order={order}
          activeIndex={inspectorIndex}
          onActiveIndexChange={setInspectorIndex}
          selected={selected}
          rotations={rotations}
          onToggleSelected={(pageNumber) => togglePage(pageNumber, false)}
          onRotate={rotatePage}
          onDelete={inspectorDelete}
          thumbnailUrlByPage={thumbnailUrlByPage}
        />
      </div>
    );
  }
);

interface PageCardProps {
  pageNumber: number;
  position: number;
  entry: PageEntry | null;
  isSelected: boolean;
  rotation: number;
  onToggle: (shiftKey: boolean) => void;
  onRotate: () => void;
  onDelete: () => void;
  onPreview: () => void;
  requestThumbnail: (pageNumber: number) => void;
  touchMenuOpen: boolean;
  onToggleTouchMenu: () => void;
}

function PageCard({
  pageNumber,
  position,
  entry,
  isSelected,
  rotation,
  onToggle,
  onRotate,
  onDelete,
  onPreview,
  requestThumbnail,
  touchMenuOpen,
  onToggleTouchMenu,
}: PageCardProps) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();

  React.useEffect(() => {
    const node = cardRef.current;
    if (!node || entry?.thumbnailUrl) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((observerEntry) => {
          if (observerEntry.isIntersecting) {
            requestThumbnail(pageNumber);
          }
        });
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entry?.thumbnailUrl, pageNumber, requestThumbnail]);

  return (
    <Reorder.Item
      value={pageNumber}
      dragListener={false}
      dragControls={dragControls}
      as="div"
      className="list-none"
    >
      <PageCardInner
        cardRef={cardRef}
        dragControls={dragControls}
        pageNumber={pageNumber}
        position={position}
        entry={entry}
        isSelected={isSelected}
        rotation={rotation}
        onToggle={onToggle}
        onRotate={onRotate}
        onDelete={onDelete}
        onPreview={onPreview}
        touchMenuOpen={touchMenuOpen}
        onToggleTouchMenu={onToggleTouchMenu}
      />
    </Reorder.Item>
  );
}

interface PageCardInnerProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  dragControls: DragControls;
  pageNumber: number;
  position: number;
  entry: PageEntry | null;
  isSelected: boolean;
  rotation: number;
  onToggle: (shiftKey: boolean) => void;
  onRotate: () => void;
  onDelete: () => void;
  onPreview: () => void;
  touchMenuOpen: boolean;
  onToggleTouchMenu: () => void;
}

function PageCardInner({
  cardRef,
  dragControls,
  pageNumber,
  position,
  entry,
  isSelected,
  rotation,
  onToggle,
  onRotate,
  onDelete,
  onPreview,
  touchMenuOpen,
  onToggleTouchMenu,
}: PageCardInnerProps) {
  return (
    <div
      ref={cardRef}
      className={`group relative overflow-hidden rounded-lg border-2 bg-card transition-colors ${
        isSelected ? "border-primary" : "border-border hover:border-primary/50"
      }`}
    >
      <button
        type="button"
        onClick={(e) => onToggle(e.shiftKey)}
        className="block w-full text-left"
      >
        <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-muted">
          {entry?.thumbnailUrl ? (
            <img
              src={entry.thumbnailUrl}
              alt={`Page ${pageNumber}`}
              className="h-full w-full object-contain bg-white"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-muted" />
          )}
          {rotation !== 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground">
              {rotation}°
            </span>
          )}
        </div>
        <span
          className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background/80 text-transparent"
          }`}
        >
          <Check className="h-3 w-3" />
        </span>
        <span className="block bg-card px-1.5 py-1 text-center text-xs text-muted-foreground">
          Page {pageNumber} · Position {position}
        </span>
      </button>

      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="absolute left-1.5 top-1.5 flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {touchMenuOpen && (
        <div className="absolute inset-0 z-10 sm:hidden" onClick={onToggleTouchMenu} />
      )}

      <div
        className={`absolute bottom-8 right-1.5 z-20 flex flex-col gap-1 transition-opacity ${
          touchMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRotate();
          }}
          aria-label="Rotate page"
          title="Rotate 90°"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          aria-label="Preview page"
          title="Preview"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Remove page"
          title="Remove from set"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-destructive shadow-sm hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleTouchMenu();
        }}
        aria-label="Page actions"
        className="absolute bottom-1.5 right-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm sm:hidden"
      >
        <GripVertical className="h-3.5 w-3.5 rotate-90" />
      </button>
    </div>
  );
}
