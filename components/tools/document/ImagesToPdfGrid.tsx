"use client";

import * as React from "react";
import { Reorder, useDragControls, type DragControls } from "framer-motion";
import { RotateCw, Trash2, GripVertical } from "lucide-react";

export interface ImagesToPdfImage {
  id: string;
  file: File;
  previewUrl: string;
}

export interface ImagesToPdfGridHandle {
  getOrder: () => string[];
  getRotations: () => Record<string, number>;
}

interface ImagesToPdfGridProps {
  images: ImagesToPdfImage[];
  /** Page margin in PDF points, mirrored here purely for the WYSIWYG padding preview. */
  marginPreview: number;
  onRemove: (id: string) => void;
  onChange?: (state: { order: string[]; rotations: Record<string, number> }) => void;
}

const MAX_PREVIEW_PADDING = 24;

export const ImagesToPdfGrid = React.forwardRef<ImagesToPdfGridHandle, ImagesToPdfGridProps>(
  function ImagesToPdfGrid({ images, marginPreview, onRemove, onChange }, ref) {
    const [order, setOrder] = React.useState<string[]>(() => images.map((img) => img.id));
    const [rotations, setRotations] = React.useState<Record<string, number>>({});

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
    }, [images]);

    const state = React.useMemo(() => ({ order, rotations }), [order, rotations]);

    React.useImperativeHandle(
      ref,
      () => ({
        getOrder: () => order,
        getRotations: () => rotations,
      }),
      [order, rotations]
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

    const imagesById = React.useMemo(() => {
      const map = new Map<string, ImagesToPdfImage>();
      images.forEach((img) => map.set(img.id, img));
      return map;
    }, [images]);

    const previewPadding = Math.min(marginPreview, MAX_PREVIEW_PADDING);

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
                previewPadding={previewPadding}
                onRotate={() => rotateImage(id)}
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
  previewPadding: number;
  onRotate: () => void;
  onDelete: () => void;
}

function ImageCard({ id, position, image, rotation, previewPadding, onRotate, onDelete }: ImageCardProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item value={id} dragListener={false} dragControls={dragControls} as="div" className="list-none">
      <ImageCardInner
        dragControls={dragControls}
        position={position}
        image={image}
        rotation={rotation}
        previewPadding={previewPadding}
        onRotate={onRotate}
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
  previewPadding: number;
  onRotate: () => void;
  onDelete: () => void;
}

function ImageCardInner({
  dragControls,
  position,
  image,
  rotation,
  previewPadding,
  onRotate,
  onDelete,
}: ImageCardInnerProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border-2 border-border bg-card transition-colors hover:border-primary/50">
      <div
        className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-muted transition-[padding]"
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
