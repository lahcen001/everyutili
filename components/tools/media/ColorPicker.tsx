"use client";

import * as React from "react";
import { ImageIcon, Pipette } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { EditorLayout, SidebarSection } from "@/components/tools/shared/EditorLayout";
import { FitStage } from "@/components/tools/shared/FitStage";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
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
  const [palette, setPalette] = React.useState<SampledColor[]>([]);
  const pickRef = React.useRef<HTMLInputElement>(null);

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

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

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
    setPalette((prev) => [color, ...prev.filter((c) => c.hex !== color.hex)].slice(0, 12));
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
      {!hasImage && (
        <DropZone
          onFiles={handleFiles}
          accept="image/*"
          multiple={false}
          label="Drag & drop an image here, or click to browse"
          hint="Click anywhere on the image to sample its exact pixel color"
        />
      )}

      {
        // The canvas stays mounted at all times (never conditionally
        // rendered) so canvasRef.current is already attached the first time
        // handleFiles runs — gating this on `hasImage` would unmount the
        // canvas until after the very draw that needs it to exist.
      }
      <div className={hasImage ? "" : "hidden"}>
        <EditorLayout
          sidebarWidth="sm"
          stage={
            <FitStage width={imageDims.width || 1} height={imageDims.height || 1}>
              <canvas ref={canvasRef} onClick={handleClick} className="block h-full w-full cursor-crosshair bg-white shadow-md" aria-label="Click to pick a colour" />
            </FitStage>
          }
          stageToolbar={
            <span className="text-xs text-muted-foreground">
              {imageDims.width}×{imageDims.height}px{cursor && ` · sampled at (${cursor.x}, ${cursor.y})`}
            </span>
          }
          sidebar={
            <>
              <SidebarSection title="Picked colour">
                {sampled ? (
                  <div className="space-y-3">
                    <div className="h-20 rounded-lg border border-border" style={{ backgroundColor: sampled.hex }} />
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
                ) : (
                  <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    <Pipette className="h-4 w-4 shrink-0" /> Click on the picture to sample a colour
                  </p>
                )}
              </SidebarSection>
              {palette.length > 0 && (
                <SidebarSection title="Recent colours" action={<button onClick={() => setPalette([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}>
                  <div className="grid grid-cols-6 gap-2">
                    {palette.map((c) => (
                      <button key={c.hex} onClick={() => setSampled(c)} title={c.hex} aria-label={`Use ${c.hex}`} className="aspect-square rounded-md border border-border" style={{ backgroundColor: c.hex }} />
                    ))}
                  </div>
                </SidebarSection>
              )}
            </>
          }
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => pickRef.current?.click()}>
                <ImageIcon className="h-3.5 w-3.5" /> New image
              </Button>
              <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            </>
          }
        />
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="color-picker" onRestore={handleRestore} />
    </div>
  );
}
