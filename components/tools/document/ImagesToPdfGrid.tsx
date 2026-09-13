"use client";

import * as React from "react";
import { Reorder, useDragControls, type DragControls } from "framer-motion";
import { RotateCw, Trash2, GripVertical, RectangleHorizontal, RectangleVertical } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ImagesToPdfImage {
  id: string;
  file: File;
  previewUrl: string;
}

/** "auto" fits the page to the (rotated) image's own aspect ratio, as before. */
export type PageOrientation = "auto" | "portrait" | "landscape";

export interface ImagesToPdfGridHandle {
  getOrder: () => string[];
  getRotations: () => Record<string, number>;
  getOrientations: () => Record<string, PageOrientation>;
  /** Per-image margin overrides, in PDF points; an id absent here falls back to the tool's global margin. */
  getMarginOverrides: () => Record<string, number>;
}

interface ImagesToPdfGridProps {
  images: ImagesToPdfImage[];
  /** Page margin in PDF points, mirrored here purely for the WYSIWYG padding preview. */
  marginPreview: number;
  onRemove: (id: string) => void;
  onChange?: (state: {
    order: string[];
    rotations: Record<string, number>;
    orientations: Record<string, PageOrientation>;
    marginOverrides: Record<string, number>;
  }) => void;
}

const MAX_PREVIEW_PADDING = 24;

export const ImagesToPdfGrid = React.forwardRef<ImagesToPdfGridHandle, ImagesToPdfGridProps>(
  function ImagesToPdfGrid({ images, marginPreview, onRemove, onChange }, ref) {
    const [order, setOrder] = React.useState<string[]>(() => images.map((img) => img.id));
    const [rotations, setRotations] = React.useState<Record<string, number>>({});
    const [orientations, setOrientations] = React.useState<Record<string, PageOrientation>>({});
    const [marginOverrides, setMarginOverrides] = React.useState<Record<string, number>>({});

    const prevIdsRef = React.useRef<string[]>(images.map((img) => img.id));

    React.useEffect(() => {
      const currentIds = images.map((img) => img.id);
      const prevIds = prevIdsRef.current;
      if (currentIds.length === prevIds.length && currentIds.every((id, i) => id === prevIds[i])) {
        return;
      }
      prevIdsRef.current = currentIds;
      const currentSet = new Set(currentIds);
      setOrder((prev) => {
        const kept = prev.filter((id) => currentSet.has(id));
        const known = new Set(kept);
        const added = currentIds.filter((id) => !known.has(id));
        return [...kept, ...added];
      });
      setRotations((prev) => {
        const next: Record<string, number> = {};
        for (const id of currentIds) {
          if (prev[id] !== undefined) next[id] = prev[id];
        }
        return next;
      });
      setOrientations((prev) => {
        const next: Record<string, PageOrientation> = {};
        for (const id of currentIds) {
          if (prev[id] !== undefined) next[id] = prev[id];
        }
        return next;
      });
      setMarginOverrides((prev) => {
        const next: Record<string, number> = {};
        for (const id of currentIds) {
          if (prev[id] !== undefined) next[id] = prev[id];
        }
        return next;
      });
    }, [images]);

    const state = React.useMemo(
      () => ({ order, rotations, orientations, marginOverrides }),
      [order, rotations, orientations, marginOverrides]
    );

    React.useImperativeHandle(
      ref,
      () => ({
        getOrder: () => order,
        getRotations: () => rotations,
        getOrientations: () => orientations,
        getMarginOverrides: () => marginOverrides,
      }),
      [order, rotations, orientations, marginOverrides]
    );

    React.useEffect(() => {
      onChange?.(state);
    }, [state, onChange]);

    const rotateImage = (id: string) => {
      setRotations((prev) => ({
        ...prev,
        [id]: ((prev[id] ?? 0) + 90) % 360,
      }));
    };

    const cycleOrientation = (id: string) => {
      setOrientations((prev) => {
        const current = prev[id] ?? "auto";
        const next: PageOrientation =
          current === "auto" ? "portrait" : current === "portrait" ? "landscape" : "auto";
        return { ...prev, [id]: next };
      });
    };

    const setImageMargin = (id: string, value: number | null) => {
      setMarginOverrides((prev) => {
        if (value === null) {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: value };
      });
    };

    const imagesById = React.useMemo(() => {
      const map = new Map<string, ImagesToPdfImage>();
      images.forEach((img) => map.set(img.id, img));
      return map;
    }, [images]);

    return (
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background p-3">
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {order.map((id, index) => {
            const image = imagesById.get(id);
            if (!image) return null;
            return (
              <ImageCard
                key={id}
                id={id}
                position={index + 1}
                image={image}
                rotation={rotations[id] ?? 0}
                orientation={orientations[id] ?? "auto"}
                marginOverride={marginOverrides[id]}
                globalMargin={marginPreview}
                onRotate={() => rotateImage(id)}
                onCycleOrientation={() => cycleOrientation(id)}
                onSetMargin={(value) => setImageMargin(id, value)}
                onDelete={() => onRemove(id)}
              />
            );
          })}
        </Reorder.Group>
      </div>
    );
  }
);

interface ImageCardProps {
  id: string;
  position: number;
  image: ImagesToPdfImage;
  rotation: number;
  orientation: PageOrientation;
  marginOverride: number | undefined;
  globalMargin: number;
  onRotate: () => void;
  onCycleOrientation: () => void;
  onSetMargin: (value: number | null) => void;
  onDelete: () => void;
}

function ImageCard({
  id,
  position,
  image,
  rotation,
  orientation,
  marginOverride,
  globalMargin,
  onRotate,
  onCycleOrientation,
  onSetMargin,
  onDelete,
}: ImageCardProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item value={id} dragListener={false} dragControls={dragControls} as="div" className="list-none">
      <ImageCardInner
        dragControls={dragControls}
        position={position}
        image={image}
        rotation={rotation}
        orientation={orientation}
        marginOverride={marginOverride}
        globalMargin={globalMargin}
        onRotate={onRotate}
        onCycleOrientation={onCycleOrientation}
        onSetMargin={onSetMargin}
        onDelete={onDelete}
      />
    </Reorder.Item>
  );
}

interface ImageCardInnerProps {
  dragControls: DragControls;
  position: number;
  image: ImagesToPdfImage;
  rotation: number;
  orientation: PageOrientation;
  marginOverride: number | undefined;
  globalMargin: number;
  onRotate: () => void;
  onCycleOrientation: () => void;
  onSetMargin: (value: number | null) => void;
  onDelete: () => void;
}

const ORIENTATION_ICON: Record<PageOrientation, React.ElementType> = {
  auto: RectangleVertical,
  portrait: RectangleVertical,
  landscape: RectangleHorizontal,
};

const ORIENTATION_LABEL: Record<PageOrientation, string> = {
  auto: "Auto",
  portrait: "Portrait",
  landscape: "Landscape",
};

function ImageCardInner({
  dragControls,
  position,
  image,
  rotation,
  orientation,
  marginOverride,
  globalMargin,
  onRotate,
  onCycleOrientation,
  onSetMargin,
  onDelete,
}: ImageCardInnerProps) {
  const effectiveMargin = marginOverride ?? globalMargin;
  const previewPadding = Math.min(effectiveMargin, MAX_PREVIEW_PADDING);
  const OrientationIcon = ORIENTATION_ICON[orientation];

  return (
    <div className="group relative overflow-hidden rounded-lg border-2 border-border bg-card transition-colors hover:border-primary/50">
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden bg-muted transition-[padding]",
          orientation === "landscape" ? "aspect-[4/3]" : "aspect-[3/4]"
        )}
        style={{ padding: previewPadding }}
      >
        <img
          src={image.previewUrl}
          alt={image.file.name}
          className="h-full w-full object-contain bg-white"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
      <span className="block bg-card px-1.5 py-1 text-center text-xs text-muted-foreground">
        Position {position}
      </span>

      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="absolute left-1.5 top-1.5 flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {rotation !== 0 && (
        <span className="absolute bottom-8 left-1.5 rounded-full border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground">
          {rotation}°
        </span>
      )}

      <div className="absolute inset-x-1.5 bottom-8 z-20 flex items-center justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onCycleOrientation}
          aria-label={`Page orientation: ${ORIENTATION_LABEL[orientation]}`}
          title={`Page orientation: ${ORIENTATION_LABEL[orientation]} (click to change)`}
          className="flex h-6 items-center gap-1 rounded-md bg-background/90 px-1.5 text-[10px] font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
        >
          <OrientationIcon className="h-3 w-3" />
          {ORIENTATION_LABEL[orientation]}
        </button>
        <label
          className="flex h-6 items-center gap-1 rounded-md bg-background/90 px-1.5 text-[10px] font-medium text-muted-foreground shadow-sm"
          title="Per-image margin override (pt)"
        >
          <input
            type="number"
            min={0}
            max={200}
            value={effectiveMargin}
            onChange={(e) => onSetMargin(Math.max(0, Number(e.target.value) || 0))}
            className="w-9 bg-transparent text-right outline-none"
          />
          pt
        </label>
      </div>

      <div className="absolute right-1.5 top-1.5 z-20 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onRotate}
          aria-label="Rotate image"
          title="Rotate 90°"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove image"
          title="Remove"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-destructive shadow-sm hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
