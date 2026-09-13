"use client";

import * as React from "react";
import { Crop, Save, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LoadedImage {
  file: File;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
}

type DragMode =
  | { kind: "move"; startX: number; startY: number; origin: CropRect }
  | { kind: "create"; startX: number; startY: number }
  | { kind: "resize"; handle: string; startX: number; startY: number; origin: CropRect };

const HANDLES = ["nw", "ne", "sw", "se"] as const;

function clampRect(rect: CropRect, bounds: { width: number; height: number }): CropRect {
  const width = Math.min(Math.max(rect.width, 1), bounds.width);
  const height = Math.min(Math.max(rect.height, 1), bounds.height);
  const x = Math.min(Math.max(rect.x, 0), bounds.width - width);
  const y = Math.min(Math.max(rect.y, 0), bounds.height - height);
  return { x, y, width, height };
}

async function cropImage(image: LoadedImage, crop: CropRect): Promise<Blob> {
  const bitmap = await createImageBitmap(image.file);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");
  ctx.drawImage(
    bitmap,
    Math.round(crop.x),
    Math.round(crop.y),
    Math.round(crop.width),
    Math.round(crop.height),
    0,
    0,
    Math.round(crop.width),
    Math.round(crop.height)
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))), "image/png");
  });
}

export default function ImageCropper() {
  useTrackTool("image-cropper");
  const [image, setImage] = React.useState<LoadedImage | null>(null);
  const [crop, setCrop] = React.useState<CropRect | null>(null);
  const [displayScale, setDisplayScale] = React.useState(1);
  const [isCropping, setIsCropping] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const dragRef = React.useRef<DragMode | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const imageUrlRef = React.useRef<string | null>(null);

  // Revoke on unmount — handleFiles/removeImage below cover the
  // replace/manual-remove paths, so this only ever fires if the user
  // navigates away with an image still loaded.
  React.useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const handleFiles = async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const naturalWidth = bitmap.width;
      const naturalHeight = bitmap.height;
      bitmap.close();

      // Revoke the previous preview URL (if any) before creating the new
      // one — loading a second image without clicking "remove" first used
      // to leak the first image's object URL indefinitely.
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      const url = URL.createObjectURL(file);
      imageUrlRef.current = url;

      setImage({ file, url, naturalWidth, naturalHeight });
      setCrop({
        x: Math.round(naturalWidth * 0.1),
        y: Math.round(naturalHeight * 0.1),
        width: Math.round(naturalWidth * 0.8),
        height: Math.round(naturalHeight * 0.8),
      });
    } catch {
      setError("Could not read this image file.");
    }
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  const removeImage = () => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    setImage(null);
    setCrop(null);
    setError(null);
  };

  const stageToImage = React.useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };
      const rect = stage.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / displayScale,
        y: (clientY - rect.top) / displayScale,
      };
    },
    [displayScale]
  );

  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = stageToImage(e.clientX, e.clientY);
    dragRef.current = { kind: "create", startX: point.x, startY: point.y };
    setCrop({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const onCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, origin: crop };
  };

  const onHandlePointerDown = (handle: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "resize", handle, startX: e.clientX, startY: e.clientY, origin: crop };
  };

  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !image) return;
    const bounds = { width: image.naturalWidth, height: image.naturalHeight };

    if (drag.kind === "create") {
      const point = stageToImage(e.clientX, e.clientY);
      const x = Math.min(drag.startX, point.x);
      const y = Math.min(drag.startY, point.y);
      const width = Math.abs(point.x - drag.startX);
      const height = Math.abs(point.y - drag.startY);
      setCrop(clampRect({ x, y, width, height }, bounds));
      return;
    }

    const dx = (e.clientX - drag.startX) / displayScale;
    const dy = (e.clientY - drag.startY) / displayScale;

    if (drag.kind === "move") {
      setCrop(clampRect({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy }, bounds));
      return;
    }

    if (drag.kind === "resize") {
      let { x, y, width, height } = drag.origin;
      if (drag.handle.includes("n")) {
        y = drag.origin.y + dy;
        height = drag.origin.height - dy;
      }
      if (drag.handle.includes("s")) {
        height = drag.origin.height + dy;
      }
      if (drag.handle.includes("w")) {
        x = drag.origin.x + dx;
        width = drag.origin.width - dx;
      }
      if (drag.handle.includes("e")) {
        width = drag.origin.width + dx;
      }
      setCrop(clampRect({ x, y, width, height }, bounds));
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const updateField = (field: keyof CropRect, value: number) => {
    if (!crop || !image) return;
    setCrop(clampRect({ ...crop, [field]: value }, { width: image.naturalWidth, height: image.naturalHeight }));
  };

  const handleCrop = async () => {
    if (!image || !crop || crop.width < 1 || crop.height < 1) return;
    setIsCropping(true);
    setError(null);
    try {
      const blob = await cropImage(image, crop);
      const baseName = image.file.name.replace(/\.[^/.]+$/, "");
      const outName = `${baseName}-cropped.png`;
      downloadBlob(blob, outName);

      await saveToolResult("image-cropper", {
        title: outName,
        summary: `${Math.round(crop.width)}x${Math.round(crop.height)}px · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to crop image.");
    } finally {
      setIsCropping(false);
    }
  };

  const stageWidth = image ? image.naturalWidth * displayScale : 0;

  return (
    <div className="space-y-6">
      {!image && (
        <DropZone
          onFiles={handleFiles}
          accept="image/*"
          multiple={false}
          label="Drag & drop an image here, or click to browse"
          hint="Drag on the image to select a crop area, then crop & download"
        />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {image && crop && (
        <>
          <Card className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{image.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {image.naturalWidth}×{image.naturalHeight}px · {formatBytes(image.file.size)}
              </p>
            </div>
            <button
              onClick={removeImage}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </Card>

          <Card className="overflow-auto p-4">
            <div
              className="relative mx-auto select-none"
              style={{ width: stageWidth || "100%", maxWidth: "100%" }}
            >
              <ImageStage
                image={image}
                onScaleChange={setDisplayScale}
                stageRef={stageRef}
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                onPointerUp={endDrag}
              >
                <div
                  onPointerDown={onCropPointerDown}
                  className="absolute cursor-move border-2 border-primary bg-primary/10"
                  style={{
                    left: crop.x * displayScale,
                    top: crop.y * displayScale,
                    width: crop.width * displayScale,
                    height: crop.height * displayScale,
                  }}
                >
                  {HANDLES.map((handle) => (
                    <div
                      key={handle}
                      onPointerDown={onHandlePointerDown(handle)}
                      className="absolute h-3 w-3 rounded-full border-2 border-primary bg-background"
                      style={{
                        cursor: handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize",
                        left: handle.includes("w") ? -6 : undefined,
                        right: handle.includes("e") ? -6 : undefined,
                        top: handle.includes("n") ? -6 : undefined,
                        bottom: handle.includes("s") ? -6 : undefined,
                      }}
                    />
                  ))}
                </div>
              </ImageStage>
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">X</span>
                <input
                  type="number"
                  min={0}
                  value={Math.round(crop.x)}
                  onChange={(e) => updateField("x", Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Y</span>
                <input
                  type="number"
                  min={0}
                  value={Math.round(crop.y)}
                  onChange={(e) => updateField("y", Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Width</span>
                <input
                  type="number"
                  min={1}
                  value={Math.round(crop.width)}
                  onChange={(e) => updateField("width", Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Height</span>
                <input
                  type="number"
                  min={1}
                  value={Math.round(crop.height)}
                  onChange={(e) => updateField("height", Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            <Button onClick={handleCrop} disabled={isCropping || crop.width < 1 || crop.height < 1}>
              <Save className="h-4 w-4" /> <Crop className="h-4 w-4" /> Crop & Download
            </Button>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="image-cropper" />
    </div>
  );
}

interface ImageStageProps {
  image: LoadedImage;
  onScaleChange: (scale: number) => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  children: React.ReactNode;
}

/**
 * Measures the available container width so the image is displayed at a
 * scale that fits, and reports that scale up so crop-rect math (done in
 * natural-image coordinates) can convert to/from displayed pixels.
 */
function ImageStage({
  image,
  onScaleChange,
  stageRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: ImageStageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = React.useMemo(() => {
    if (containerWidth <= 0) return 1;
    return Math.min(1, containerWidth / image.naturalWidth);
  }, [containerWidth, image.naturalWidth]);

  React.useEffect(() => {
    onScaleChange(scale);
  }, [scale, onScaleChange]);

  return (
    <div ref={containerRef} className="w-full">
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative touch-none"
        style={{ width: image.naturalWidth * scale, height: image.naturalHeight * scale }}
      >
        <img
          src={image.url}
          alt="Uploaded image to crop"
          className="pointer-events-none absolute inset-0 h-full w-full"
          draggable={false}
        />
        {children}
      </div>
    </div>
  );
}
