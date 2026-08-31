"use client";

import * as React from "react";
import { Pipette } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import {
  ToolHistoryList,
  type ToolHistoryListHandle,
} from "@/components/tools/shared/ToolHistoryList";

interface SampledColor {
  hex: string;
  rgb: string;
  hsl: string;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export default function ColorPicker() {
  useTrackTool("color-picker");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const [hasImage, setHasImage] = React.useState(false);
  const [imageDims, setImageDims] = React.useState({ width: 0, height: 0 });
  const [sampled, setSampled] = React.useState<SampledColor | null>(null);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const bitmap = await createImageBitmap(file);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(bitmap, 0, 0);
    bitmap.close();
    setImageDims({ width: bitmap.width, height: bitmap.height });
    setHasImage(true);
    setSampled(null);
  };

  const handleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    const color: SampledColor = {
      hex: rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: rgbToHsl(r, g, b),
    };
    setSampled(color);
    setCursor({ x, y });

    await saveToolResult("color-picker", {
      title: color.hex,
      summary: `${color.rgb} · ${color.hsl}`,
      data: JSON.stringify(color),
    });
    historyRef.current?.refresh();
  };

  const handleRestore = (item: ToolHistoryItem) => {
    if (!item.data) return;
    try {
      const color = JSON.parse(item.data) as SampledColor;
      setSampled(color);
    } catch {
      // Ignore malformed stored data.
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/*"
        multiple={false}
        label="Drag & drop an image here, or click to browse"
        hint="Click anywhere on the image to sample its exact pixel color"
      />

      {
        // The canvas stays mounted at all times (never conditionally
        // rendered) so canvasRef.current is already attached the first time
        // handleFiles runs — gating this on `hasImage` would unmount the
        // canvas until after the very draw that needs it to exist.
      }
      <Card className={`space-y-4 p-4 ${hasImage ? "" : "hidden"}`}>
        <div className="relative w-full overflow-auto rounded-lg border border-border">
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            className="max-w-full cursor-crosshair"
            style={{ width: "100%", height: "auto" }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {imageDims.width}×{imageDims.height}px
          {cursor && ` · sampled at (${cursor.x}, ${cursor.y})`}
        </p>
      </Card>

      {sampled ? (
        <Card className="flex flex-wrap items-center gap-4 p-4">
          <div
            className="h-16 w-16 shrink-0 rounded-lg border border-border"
            style={{ backgroundColor: sampled.hex }}
          />
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            {[
              { label: "HEX", value: sampled.hex },
              { label: "RGB", value: sampled.rgb },
              { label: "HSL", value: sampled.hsl },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-mono text-sm">{item.value}</p>
                </div>
                <CopyButton value={item.value} size="sm" variant="ghost" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        hasImage && (
          <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Pipette className="h-4 w-4" /> Click on the image above to sample a color
          </Card>
        )
      )}

      <ToolHistoryList ref={historyRef} toolSlug="color-picker" onRestore={handleRestore} />
    </div>
  );
}
