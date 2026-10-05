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
import { readJpegOrientation } from "@/lib/exif";
import { fitImageToPage } from "@/lib/pdf/layout";

const MARGIN_PRESETS = [
  { label: "None", value: 0 },
  { label: "Small", value: 18 },
  { label: "Medium", value: 36 },
  { label: "Large", value: 54 },
] as const;

// Page sizes in PDF points, portrait. "fit" sizes each page to its image instead.
const PAGE_SIZES = {
  fit: null,
  a4: [595.28, 841.89],
  letter: [612, 792],
  a5: [419.53, 595.28],
} as const;
type PageSizeKey = keyof typeof PAGE_SIZES;

const PAGE_SIZE_LABELS: Record<PageSizeKey, string> = {
  fit: "Fit to image",
  a4: "A4",
  letter: "US Letter",
  a5: "A5",
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];

interface PreparedImage {
  bytes: ArrayBuffer;
  width: number;
  height: number;
  isPng: boolean;
}

/**
 * pdf-lib can only embed JPEG/PNG bytes as-is, and it ignores EXIF orientation (a phone photo
 * would appear sideways). So an image is passed through a canvas whenever it needs rotating, has
 * an EXIF orientation, or isn't JPEG/PNG (WebP/GIF/BMP). Untouched JPEG/PNG files are embedded
 * byte-for-byte so there is no quality loss. Canvas output is JPEG for JPEG/BMP sources and PNG
 * otherwise, which keeps transparency.
 */
async function prepareImage(file: File, rotation: number): Promise<PreparedImage> {
  const original = await file.arrayBuffer();
  const isJpeg = file.type === "image/jpeg";
  const isPngSource = file.type === "image/png";
  const exifOrientation = isJpeg ? readJpegOrientation(original) : 1;

  if (rotation === 0 && exifOrientation === 1 && (isJpeg || isPngSource)) {
    return { bytes: original, width: 0, height: 0, isPng: isPngSource };
  }

  const outputPng = file.type !== "image/jpeg" && file.type !== "image/bmp";
  // createImageBitmap applies EXIF orientation by default, so only the user's rotation is added here.
  const bitmap = await createImageBitmap(file);
  const swapDimensions = rotation === 90 || rotation === 270;
  const width = swapDimensions ? bitmap.height : bitmap.width;
  const height = swapDimensions ? bitmap.width : bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");

  if (!outputPng) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputPng ? "image/png" : "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("Failed to render image.");
  return { bytes: await blob.arrayBuffer(), width, height, isPng: outputPng };
}

export default function ImagesToPdf() {
  useTrackTool("images-to-pdf");
  const [items, setItems] = React.useState<ImagesToPdfImage[]>([]);
  const [margin, setMargin] = React.useState<number>(0);
  const [pageSize, setPageSize] = React.useState<PageSizeKey>("a4");
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const gridRef = React.useRef<ImagesToPdfGridHandle>(null);

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter((f) => ACCEPTED_TYPES.includes(f.type));
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

        const prepared = await prepareImage(item.file, rotation);
        const embedded = prepared.isPng ? await pdf.embedPng(prepared.bytes) : await pdf.embedJpg(prepared.bytes);
        const width = prepared.width || embedded.width;
        const height = prepared.height || embedded.height;

        const fixedSize = PAGE_SIZES[pageSize];
        if (fixedSize) {
          const layout = fitImageToPage(width, height, fixedSize, orientation, itemMargin);
          const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);
          page.drawImage(embedded, { x: layout.x, y: layout.y, width: layout.width, height: layout.height });
          continue;
        }

        // "Fit to image": the page takes the image's own size (plus margin). A forced orientation
        // letterboxes the image inside a page shaped for that orientation instead of stretching it.
        let pageWidth = width;
        let pageHeight = height;
        let drawWidth = width;
        let drawHeight = height;
        let drawX = itemMargin;
        let drawY = itemMargin;

        if (orientation !== "auto") {
          const wantsLandscape = orientation === "landscape";
          const isLandscape = width >= height;
          if (wantsLandscape !== isLandscape) {
            const long = Math.max(width, height);
            const short = Math.min(width, height);
            pageWidth = wantsLandscape ? long : short;
            pageHeight = wantsLandscape ? short : long;
            const scale = Math.min(pageWidth / width, pageHeight / height);
            drawWidth = width * scale;
            drawHeight = height * scale;
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
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
        label="Drag & drop images here, or click to browse"
        hint="JPG, PNG, WebP, GIF or BMP — reorder, rotate, and pick a page size before creating the PDF"
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <>
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-medium">Page size</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setPageSize(key)}
                  aria-pressed={pageSize === key}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    pageSize === key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {PAGE_SIZE_LABELS[key]}
                </button>
              ))}
            </div>
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
