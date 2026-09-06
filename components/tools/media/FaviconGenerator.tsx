"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, Loader2, Star } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const SIZES = [16, 32, 48, 180, 192, 512];

async function renderSquarePng(bitmap: ImageBitmap, size: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");

  // Cover-fit: crop to a centered square, then scale.
  const srcSize = Math.min(bitmap.width, bitmap.height);
  const srcX = (bitmap.width - srcSize) / 2;
  const srcY = (bitmap.height - srcSize) / 2;
  ctx.drawImage(bitmap, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Render failed"))), "image/png");
  });
}

export default function FaviconGenerator() {
  useTrackTool("favicon-generator");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [bitmap, setBitmap] = React.useState<ImageBitmap | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const bitmapRef = React.useRef<ImageBitmap | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    const img = await createImageBitmap(file);
    bitmapRef.current?.close();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    bitmapRef.current = img;
    previewUrlRef.current = nextPreviewUrl;
    setBitmap(img);
    setPreviewUrl(nextPreviewUrl);
    setFileName(file.name);
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  React.useEffect(() => {
    return () => {
      bitmapRef.current?.close();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const generateZip = async () => {
    if (!bitmap) return;
    setIsGenerating(true);
    setError(null);
    try {
      const zip = new JSZip();
      for (const size of SIZES) {
        const blob = await renderSquarePng(bitmap, size);
        zip.file(`favicon-${size}x${size}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, "favicons.zip");

      await saveToolResult("favicon-generator", {
        title: "favicons.zip",
        summary: `${fileName ?? "source image"} → ${SIZES.length} sizes (${formatBytes(zipBlob.size)})`,
        blob: zipBlob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate favicons.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/*"
        multiple={false}
        label="Drag & drop a square logo or image here, or click to browse"
        hint="Generates 16, 32, 48, 180, 192, and 512px PNGs as a ZIP"
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {previewUrl && bitmap && (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-4">
            <img
              src={previewUrl}
              alt="Uploaded logo preview"
              className="h-16 w-16 rounded-lg border border-border object-cover"
            />
            <div>
              <p className="text-sm font-medium">Source image ready</p>
              <p className="text-xs text-muted-foreground">
                {bitmap.width}×{bitmap.height}px — will be center-cropped to a square
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {SIZES.map((size) => (
              <div key={size} className="flex flex-col items-center gap-1">
                <div
                  className="flex items-center justify-center rounded-lg border border-border bg-muted/30"
                  style={{ width: Math.min(size, 64), height: Math.min(size, 64) }}
                >
                  <Star className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">{size}px</span>
              </div>
            ))}
          </div>

          <Button onClick={generateZip} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Download favicon ZIP
              </>
            )}
          </Button>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="favicon-generator" />
    </div>
  );
}
