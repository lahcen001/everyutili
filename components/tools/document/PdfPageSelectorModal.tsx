"use client";

import * as React from "react";
import { Check, Loader2, Square, CheckSquare } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
}

interface PdfPageSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  /** Pages already selected when the modal opens. */
  initialSelected: Set<number>;
  onConfirm: (selected: Set<number>) => void;
}

/**
 * Thin wrapper around the Dialog: the inner content only mounts while
 * `open` is true, and remounts (via `key`) each time the modal opens. That
 * makes `initialSelected` a legitimate one-time lazy useState initializer
 * inside PdfPageSelectorContent instead of something that needs a
 * sync-on-open effect, which would trip react-hooks/set-state-in-effect.
 */
export function PdfPageSelectorModal({
  open,
  onOpenChange,
  file,
  initialSelected,
  onConfirm,
}: PdfPageSelectorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PdfPageSelectorContent
          key={file ? file.name + file.lastModified : "empty"}
          file={file}
          initialSelected={initialSelected}
          onConfirm={onConfirm}
          onOpenChange={onOpenChange}
        />
      )}
    </Dialog>
  );
}

interface PdfPageSelectorContentProps {
  file: File | null;
  initialSelected: Set<number>;
  onConfirm: (selected: Set<number>) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renders every page of `file` as a thumbnail (via pdfjs, same approach as
 * PdfToImages.tsx) and lets the user click pages to toggle selection,
 * instead of typing a range string like "2, 4-6" blind.
 */
function PdfPageSelectorContent({
  file,
  initialSelected,
  onConfirm,
  onOpenChange,
}: PdfPageSelectorContentProps) {
  const [thumbnails, setThumbnails] = React.useState<PageThumbnail[]>([]);
  const [isRendering, setIsRendering] = React.useState(() => file !== null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set(initialSelected));

  React.useEffect(() => {
    if (!file) return;

    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const bytes = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const rendered: PageThumbnail[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not acquire canvas context");
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          rendered.push({ pageNumber: pageNum, dataUrl: canvas.toDataURL("image/png") });
        }

        if (!cancelled) setThumbnails(rendered);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render PDF pages.");
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const togglePage = (pageNumber: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(thumbnails.map((t) => t.pageNumber)));
  const selectNone = () => setSelected(new Set());

  const handleConfirm = () => {
    onConfirm(selected);
    onOpenChange(false);
  };

  return (
    <DialogContent className="max-w-3xl max-h-[85vh] grid-rows-[auto_1fr_auto] p-0">
      <DialogHeader className="border-b border-border px-6 py-4">
        <DialogTitle>Select pages</DialogTitle>
        <DialogDescription>
          Click a page to select it. {selected.size} of {thumbnails.length || "…"} selected.
        </DialogDescription>
      </DialogHeader>

      <div className="overflow-y-auto px-6 py-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {isRendering && (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Rendering pages…
          </div>
        )}

        {!isRendering && thumbnails.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {thumbnails.map((thumb) => {
              const isSelected = selected.has(thumb.pageNumber);
              return (
                <button
                  key={thumb.pageNumber}
                  type="button"
                  onClick={() => togglePage(thumb.pageNumber)}
                  className={`group relative overflow-hidden rounded-lg border-2 text-left transition-colors ${
                    isSelected ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <img src={thumb.dataUrl} alt={`Page ${thumb.pageNumber}`} className="w-full bg-white" />
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
                    {thumb.pageNumber}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <DialogFooter className="border-t border-border px-6 py-4">
        <div className="mr-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={selectAll} disabled={thumbnails.length === 0}>
            <CheckSquare className="h-3.5 w-3.5" /> Select all
          </Button>
          <Button size="sm" variant="outline" onClick={selectNone} disabled={selected.size === 0}>
            <Square className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={selected.size === 0}>
          Use {selected.size} page{selected.size === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
