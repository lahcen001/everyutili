"use client";

import * as React from "react";
import { PDFDocument } from "pdf-lib";
import { FileImage, Loader2 } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import {
  ImagesToPdfGrid,
  type ImagesToPdfGridHandle,
  type ImagesToPdfImage,
  type PageOrientation,
} from "@/components/tools/document/ImagesToPdfGrid";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";

const MARGIN_PRESETS = [
  { label: "None", value: 0 },
  { label: "Small", value: 18 },
  { label: "Medium", value: 36 },
  { label: "Large", value: 54 },
] as const;

/**
 * pdf-lib has no "rotate raster image" op, so a rotated page would only rotate
 * the page box, not the pixels drawn onto it. To get an actually-rotated
 * image in the output, the source bitmap is first redrawn onto an offscreen
 * canvas at the target angle, then that canvas is re-exported to bytes and
 * embedded as a fresh (already-rotated) image.
 */
async function rotateImageBytes(
  file: File,
  rotation: number
): Promise<{ bytes: ArrayBuffer; width: number; height: number; isPng: boolean }> {
  const isPng = file.type === "image/png";
  const bitmap = await createImageBitmap(file);
  const swapDimensions = rotation === 90 || rotation === 270;
  const width = swapDimensions ? bitmap.height : bitmap.width;
  const height = swapDimensions ? bitmap.width : bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");

  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, isPng ? "image/png" : "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("Failed to render rotated image.");
  const bytes = await blob.arrayBuffer();
  return { bytes, width, height, isPng };
}

export default function ImagesToPdf() {
  useTrackTool("images-to-pdf");
  const [items, setItems] = React.useState<ImagesToPdfImage[]>([]);
  const [margin, setMargin] = React.useState<number>(0);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const gridRef = React.useRef<ImagesToPdfGridHandle>(null);

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter((f) => f.type === "image/jpeg" || f.type === "image/png");
    setItems((prev) => [
      ...prev,
      ...imageFiles.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })),
    ]);
    setError(null);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const itemsRef = React.useRef(items);

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const buildPdf = async () => {
    if (items.length === 0) {
      setError("Add at least one image.");
      return;
    }
    setIsBuilding(true);
    setError(null);

    try {
      const order = gridRef.current?.getOrder() ?? items.map((item) => item.id);
      const rotations = gridRef.current?.getRotations() ?? {};
      const orientations = gridRef.current?.getOrientations() ?? {};
      const marginOverrides = gridRef.current?.getMarginOverrides() ?? {};
      const itemsById = new Map(items.map((item) => [item.id, item]));

      const pdf = await PDFDocument.create();

      for (const id of order) {
        const item = itemsById.get(id);
        if (!item) continue;
        const rotation = rotations[id] ?? 0;
        const orientation: PageOrientation = orientations[id] ?? "auto";
        const itemMargin = marginOverrides[id] ?? margin;

        let width: number;
        let height: number;
        let embedded;
        if (rotation !== 0) {
          const rotated = await rotateImageBytes(item.file, rotation);
          embedded = rotated.isPng
            ? await pdf.embedPng(rotated.bytes)
            : await pdf.embedJpg(rotated.bytes);
          width = rotated.width;
          height = rotated.height;
        } else {
          const bytes = await item.file.arrayBuffer();
          embedded =
            item.file.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          width = embedded.width;
          height = embedded.height;
        }

        // "auto" fits the page to the (rotated) image's own aspect ratio, as
        // before. A forced orientation instead fits the image inside a page
        // shaped for that orientation, centered, with letterboxing rather
        // than stretching — the page's long/short sides swap to match
        // whichever of width/height should be larger.
        let pageWidth = width;
        let pageHeight = height;
        let drawWidth = width;
        let drawHeight = height;
        let drawX = itemMargin;
        let drawY = itemMargin;

        if (orientation !== "auto") {
          const contentWidth = width;
          const contentHeight = height;
          const wantsLandscape = orientation === "landscape";
          const isLandscape = contentWidth >= contentHeight;
          if (wantsLandscape !== isLandscape) {
            // Swap the page's content-box dimensions so the page shape
            // matches the requested orientation instead of the image's own.
            const swapped = Math.max(contentWidth, contentHeight);
            const short = Math.min(contentWidth, contentHeight);
            pageWidth = wantsLandscape ? swapped : short;
            pageHeight = wantsLandscape ? short : swapped;
            const scale = Math.min(pageWidth / contentWidth, pageHeight / contentHeight);
            drawWidth = contentWidth * scale;
            drawHeight = contentHeight * scale;
            drawX = itemMargin + (pageWidth - drawWidth) / 2;
            drawY = itemMargin + (pageHeight - drawHeight) / 2;
          }
        }

        const page = pdf.addPage([pageWidth + itemMargin * 2, pageHeight + itemMargin * 2]);
        page.drawImage(embedded, { x: drawX, y: drawY, width: drawWidth, height: drawHeight });
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      downloadBlob(blob, "images.pdf");

      await saveToolResult("images-to-pdf", {
        title: "images.pdf",
        summary: `${items.length} image${items.length === 1 ? "" : "s"} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build PDF.");
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/jpeg,image/png"
        label="Drag & drop JPG or PNG images here, or click to browse"
        hint="Drag thumbnails to reorder, rotate, and set a page margin before creating the PDF"
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <>
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-medium">Page margin</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {MARGIN_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setMargin(preset.value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    margin === preset.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Custom (pt)
              <input
                type="number"
                min={0}
                max={200}
                value={margin}
                onChange={(e) => setMargin(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {items.length} image{items.length === 1 ? "" : "s"}
            </span>
          </Card>

          <Card className="space-y-4 p-4">
            <ImagesToPdfGrid ref={gridRef} images={items} marginPreview={margin} onRemove={removeItem} />

            <Button onClick={buildPdf} disabled={isBuilding}>
              {isBuilding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Building PDF…
                </>
              ) : (
                <>
                  <FileImage className="h-4 w-4" /> Create & Download PDF
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="images-to-pdf" />
    </div>
  );
}
