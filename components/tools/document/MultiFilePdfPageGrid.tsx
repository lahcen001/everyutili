"use client";

import * as React from "react";
import { Reorder, useDragControls, type DragControls } from "framer-motion";
import { RotateCw, Trash2, GripVertical, FileText, Loader2 } from "lucide-react";

export interface MultiFilePdfPageId {
  fileIndex: number;
  pageNumber: number;
}

export interface MultiFilePdfPageGridHandle {
  getOrder: () => MultiFilePdfPageId[];
  getRotations: () => Record<string, number>;
}

interface MultiFilePdfPageGridProps {
  files: File[];
  onChange?: (order: MultiFilePdfPageId[]) => void;
}

interface PageEntry {
  key: string;
  fileIndex: number;
  pageNumber: number;
  dataUrl: string | null;
}

interface FileLoadState {
  fileIndex: number;
  fileName: string;
  status: "loading" | "ready" | "error";
  errorMessage: string | null;
  pdfDoc: import("pdfjs-dist").PDFDocumentProxy | null;
}

const THUMBNAIL_SCALE = 0.5;
const FILE_TAG_COLORS = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
];

function fileTagColor(fileIndex: number): string {
  return FILE_TAG_COLORS[fileIndex % FILE_TAG_COLORS.length];
}

function pageKey(fileIndex: number, pageNumber: number): string {
  return `${fileIndex}:${pageNumber}`;
}

async function renderPageToDataUrl(
  pdf: import("pdfjs-dist").PDFDocumentProxy,
  pageNumber: number,
  scale: number
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

export const MultiFilePdfPageGrid = React.forwardRef<
  MultiFilePdfPageGridHandle,
  MultiFilePdfPageGridProps
>(function MultiFilePdfPageGrid({ files, onChange }, ref) {
  const [fileStates, setFileStates] = React.useState<FileLoadState[]>([]);
  const [pages, setPages] = React.useState<PageEntry[]>([]);
  const [order, setOrder] = React.useState<string[]>([]);
  const [rotations, setRotations] = React.useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  const renderingRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const nextFileStates: FileLoadState[] = [];
      const nextPages: PageEntry[] = [];

      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        try {
          const bytes = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
          nextFileStates.push({
            fileIndex,
            fileName: file.name,
            status: "ready",
            errorMessage: null,
            pdfDoc: pdf,
          });
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            nextPages.push({
              key: pageKey(fileIndex, pageNumber),
              fileIndex,
              pageNumber,
              dataUrl: null,
            });
          }
        } catch (e) {
          nextFileStates.push({
            fileIndex,
            fileName: file.name,
            status: "error",
            errorMessage: e instanceof Error ? e.message : "Failed to read this PDF file.",
            pdfDoc: null,
          });
        }
      }

      if (cancelled) return;

      setFileStates(nextFileStates);
      setPages(nextPages);
      setOrder(nextPages.map((p) => p.key));
      setRotations({});
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [files]);

  const pdfDocByFileIndex = React.useMemo(() => {
    const map = new Map<number, import("pdfjs-dist").PDFDocumentProxy>();
    fileStates.forEach((f) => {
      if (f.pdfDoc) map.set(f.fileIndex, f.pdfDoc);
    });
    return map;
  }, [fileStates]);

  const requestThumbnail = React.useCallback(
    (key: string, fileIndex: number, pageNumber: number) => {
      if (renderingRef.current.has(key)) return;
      const pdfDoc = pdfDocByFileIndex.get(fileIndex);
      if (!pdfDoc) return;
      renderingRef.current.add(key);

      renderPageToDataUrl(pdfDoc, pageNumber, THUMBNAIL_SCALE)
        .then((dataUrl) => {
          setPages((prev) => prev.map((p) => (p.key === key ? { ...p, dataUrl } : p)));
        })
        .catch(() => {
          renderingRef.current.delete(key);
        });
    },
    [pdfDocByFileIndex]
  );

  const orderedIds = React.useMemo<MultiFilePdfPageId[]>(
    () =>
      order.map((key) => {
        const [fileIndexStr, pageNumberStr] = key.split(":");
        return { fileIndex: Number(fileIndexStr), pageNumber: Number(pageNumberStr) };
      }),
    [order]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      getOrder: () => orderedIds,
      getRotations: () => rotations,
    }),
    [orderedIds, rotations]
  );

  React.useEffect(() => {
    onChange?.(orderedIds);
  }, [orderedIds, onChange]);

  const rotatePage = (key: string) => {
    setRotations((prev) => ({
      ...prev,
      [key]: ((prev[key] ?? 0) + 90) % 360,
    }));
  };

  const deletePageFromOrder = (key: string) => {
    setOrder((prev) => prev.filter((k) => k !== key));
    setPages((prev) => prev.filter((p) => p.key !== key));
    setRotations((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const pagesByKey = React.useMemo(() => {
    const map = new Map<string, PageEntry>();
    pages.forEach((p) => map.set(p.key, p));
    return map;
  }, [pages]);

  const fileNameByIndex = React.useMemo(() => {
    const map = new Map<number, string>();
    fileStates.forEach((f) => map.set(f.fileIndex, f.fileName));
    return map;
  }, [fileStates]);

  const erroredFiles = fileStates.filter((f) => f.status === "error");

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-lg border border-border text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Reading PDFs…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {erroredFiles.length > 0 && (
        <div className="space-y-1">
          {erroredFiles.map((f) => (
            <div
              key={f.fileIndex}
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              Could not read <span className="font-medium">{f.fileName}</span> — {f.errorMessage}
              . Its pages were skipped.
            </div>
          ))}
        </div>
      )}

      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background p-3">
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {order.map((key, index) => {
            const entry = pagesByKey.get(key) ?? null;
            return (
              <PageCard
                key={key}
                pageKey={key}
                fileIndex={entry?.fileIndex ?? 0}
                pageNumber={entry?.pageNumber ?? 0}
                fileName={fileNameByIndex.get(entry?.fileIndex ?? -1) ?? ""}
                position={index + 1}
                entry={entry}
                rotation={rotations[key] ?? 0}
                onRotate={() => rotatePage(key)}
                onDelete={() => deletePageFromOrder(key)}
                requestThumbnail={requestThumbnail}
              />
            );
          })}
        </Reorder.Group>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
        <span className="text-xs font-medium text-muted-foreground">
          {order.length} page{order.length === 1 ? "" : "s"} across {fileStates.filter((f) => f.status === "ready").length} file
          {fileStates.filter((f) => f.status === "ready").length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
});

interface PageCardProps {
  pageKey: string;
  fileIndex: number;
  pageNumber: number;
  fileName: string;
  position: number;
  entry: PageEntry | null;
  rotation: number;
  onRotate: () => void;
  onDelete: () => void;
  requestThumbnail: (key: string, fileIndex: number, pageNumber: number) => void;
}

function PageCard({
  pageKey,
  fileIndex,
  pageNumber,
  fileName,
  position,
  entry,
  rotation,
  onRotate,
  onDelete,
  requestThumbnail,
}: PageCardProps) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();

  React.useEffect(() => {
    const node = cardRef.current;
    if (!node || entry?.dataUrl) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((observerEntry) => {
          if (observerEntry.isIntersecting) {
            requestThumbnail(pageKey, fileIndex, pageNumber);
          }
        });
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entry?.dataUrl, pageKey, fileIndex, pageNumber, requestThumbnail]);

  return (
    <Reorder.Item value={pageKey} dragListener={false} dragControls={dragControls} as="div" className="list-none">
      <PageCardInner
        cardRef={cardRef}
        dragControls={dragControls}
        pageNumber={pageNumber}
        fileName={fileName}
        fileIndex={fileIndex}
        position={position}
        entry={entry}
        rotation={rotation}
        onRotate={onRotate}
        onDelete={onDelete}
      />
    </Reorder.Item>
  );
}

interface PageCardInnerProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  dragControls: DragControls;
  pageNumber: number;
  fileName: string;
  fileIndex: number;
  position: number;
  entry: PageEntry | null;
  rotation: number;
  onRotate: () => void;
  onDelete: () => void;
}

function PageCardInner({
  cardRef,
  dragControls,
  pageNumber,
  fileName,
  fileIndex,
  position,
  entry,
  rotation,
  onRotate,
  onDelete,
}: PageCardInnerProps) {
  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-lg border-2 border-border bg-card transition-colors hover:border-primary/50"
    >
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-muted">
        {entry?.dataUrl ? (
          <img
            src={entry.dataUrl}
            alt={`${fileName} page ${pageNumber}`}
            className="h-full w-full object-contain bg-white"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted" />
        )}
      </div>

      <span
        className={`absolute left-1.5 top-1.5 max-w-[calc(100%-3rem)] truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${fileTagColor(
          fileIndex
        )}`}
        title={fileName}
      >
        <FileText className="mr-0.5 inline-block h-2.5 w-2.5 align-[-1px]" />
        {fileName}
      </span>

      <span className="block bg-card px-1.5 py-1 text-center text-xs text-muted-foreground">
        Page {pageNumber} · Position {position}
      </span>

      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="absolute bottom-8 right-1.5 z-20 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
            onDelete();
          }}
          aria-label="Remove page"
          title="Remove from set"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-destructive shadow-sm hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
