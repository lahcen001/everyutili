"use client";

import * as React from "react";
import { Download, ImageIcon, Loader2 } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { EditorLayout, SidebarSection, SliderRow } from "@/components/tools/shared/EditorLayout";
import { FitStage } from "@/components/tools/shared/FitStage";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

type WindowTheme = "macos-dark" | "macos-light" | "windows11" | "glass" | "none";
type ShadowDepth = "none" | "soft" | "deep" | "glow";
type ExportFormat = "png" | "webp";
type ExportScale = 1 | 2 | 4;

interface Preset {
  theme: WindowTheme;
  padding: number;
  radius: number;
  shadow: ShadowDepth;
  background: string;
}

const THEMES: { value: WindowTheme; label: string }[] = [
  { value: "macos-dark", label: "macOS Dark" },
  { value: "macos-light", label: "macOS Light" },
  { value: "windows11", label: "Windows 11" },
  { value: "glass", label: "Glass" },
  { value: "none", label: "None" },
];

const SHADOWS: { value: ShadowDepth; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "deep", label: "Deep" },
  { value: "glow", label: "Colored Glow" },
];

const BACKGROUNDS: { value: string; label: string }[] = [
  { value: "linear-gradient(135deg, #6366f1, #a855f7)", label: "Indigo" },
  { value: "linear-gradient(135deg, #f59e0b, #ef4444)", label: "Sunset" },
  { value: "linear-gradient(135deg, #10b981, #3b82f6)", label: "Ocean" },
  { value: "linear-gradient(135deg, #ec4899, #8b5cf6)", label: "Candy" },
  { value: "#0b0d13", label: "Obsidian" },
  { value: "#f3f4f6", label: "Light Gray" },
];

const DEFAULT_PRESET: Preset = {
  theme: "macos-dark",
  padding: 64,
  radius: 14,
  shadow: "deep",
  background: BACKGROUNDS[0].value,
};

const TITLEBAR_HEIGHT = 34;

/** Draws the window chrome (title bar + traffic lights, if any) for the given theme onto ctx. */
function drawWindowChrome(
  ctx: CanvasRenderingContext2D,
  theme: WindowTheme,
  x: number,
  y: number,
  width: number
) {
  if (theme === "none") return;

  if (theme === "macos-dark" || theme === "macos-light") {
    ctx.fillStyle = theme === "macos-dark" ? "#2b2d33" : "#e8e8ea";
    ctx.fillRect(x, y, width, TITLEBAR_HEIGHT);
    const dotColors = ["#ff5f57", "#febc2e", "#28c840"];
    dotColors.forEach((color, i) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x + 18 + i * 20, y + TITLEBAR_HEIGHT / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (theme === "windows11") {
    ctx.fillStyle = "#202020";
    ctx.fillRect(x, y, width, TITLEBAR_HEIGHT);
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1.5;
    const controlsX = x + width - 70;
    // minimize
    ctx.beginPath();
    ctx.moveTo(controlsX, y + TITLEBAR_HEIGHT / 2);
    ctx.lineTo(controlsX + 12, y + TITLEBAR_HEIGHT / 2);
    ctx.stroke();
    // maximize
    ctx.strokeRect(controlsX + 24, y + TITLEBAR_HEIGHT / 2 - 6, 12, 12);
    // close
    ctx.beginPath();
    ctx.moveTo(controlsX + 48, y + TITLEBAR_HEIGHT / 2 - 6);
    ctx.lineTo(controlsX + 60, y + TITLEBAR_HEIGHT / 2 + 6);
    ctx.moveTo(controlsX + 60, y + TITLEBAR_HEIGHT / 2 - 6);
    ctx.lineTo(controlsX + 48, y + TITLEBAR_HEIGHT / 2 + 6);
    ctx.stroke();
  } else if (theme === "glass") {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, width, TITLEBAR_HEIGHT);
    const dotColors = ["rgba(255,95,87,0.9)", "rgba(254,188,46,0.9)", "rgba(40,200,64,0.9)"];
    dotColors.forEach((color, i) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x + 18 + i * 20, y + TITLEBAR_HEIGHT / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function shadowFor(depth: ShadowDepth): { color: string; blur: number; offsetY: number } {
  switch (depth) {
    case "soft":
      return { color: "rgba(0,0,0,0.25)", blur: 24, offsetY: 8 };
    case "deep":
      return { color: "rgba(0,0,0,0.45)", blur: 60, offsetY: 24 };
    case "glow":
      return { color: "rgba(99,102,241,0.55)", blur: 70, offsetY: 0 };
    default:
      return { color: "transparent", blur: 0, offsetY: 0 };
  }
}

export default function ScreenshotBeautifier() {
  useTrackTool("screenshot-beautifier");

  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [preset, setPreset] = React.useState<Preset>(DEFAULT_PRESET);
  const [scale, setScale] = React.useState<ExportScale>(2);
  const [format, setFormat] = React.useState<ExportFormat>("png");
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const imageUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const loadFile = React.useCallback((file: File) => {
    setError(null);
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    imageUrlRef.current = url;
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError("Could not load that image.");
    img.src = url;
  }, []);

  const handleFiles = React.useCallback(
    (files: File[]) => {
      const file = files.find((f) => f.type.startsWith("image/"));
      if (file) loadFile(file);
    },
    [loadFile]
  );

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  // Clipboard paste (Ctrl+V) support.
  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) loadFile(file);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [loadFile]);

  // Live preview render at 1x, high-DPI aware.
  const render = React.useCallback(
    (targetScale: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return;

      const chromeHeight = preset.theme === "none" ? 0 : TITLEBAR_HEIGHT;
      const contentWidth = image.naturalWidth;
      const contentHeight = image.naturalHeight + chromeHeight;

      const outWidth = Math.round((contentWidth + preset.padding * 2) * targetScale);
      const outHeight = Math.round((contentHeight + preset.padding * 2) * targetScale);

      canvas.width = outWidth;
      canvas.height = outHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(targetScale, 0, 0, targetScale, 0, 0);
      ctx.clearRect(0, 0, contentWidth + preset.padding * 2, contentHeight + preset.padding * 2);

      // Background.
      if (preset.background.startsWith("linear-gradient")) {
        const grad = ctx.createLinearGradient(0, 0, contentWidth + preset.padding * 2, contentHeight + preset.padding * 2);
        const stops = preset.background.match(/#[0-9a-fA-F]{3,8}/g) ?? ["#6366f1", "#a855f7"];
        grad.addColorStop(0, stops[0]);
        grad.addColorStop(1, stops[1] ?? stops[0]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = preset.background;
      }
      ctx.fillRect(0, 0, contentWidth + preset.padding * 2, contentHeight + preset.padding * 2);

      const frameX = preset.padding;
      const frameY = preset.padding;

      // Shadow.
      const shadow = shadowFor(preset.shadow);
      ctx.save();
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetY = shadow.offsetY;
      roundedRectPath(ctx, frameX, frameY, contentWidth, contentHeight, preset.radius);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();

      // Clip to rounded frame, draw chrome + screenshot.
      ctx.save();
      roundedRectPath(ctx, frameX, frameY, contentWidth, contentHeight, preset.radius);
      ctx.clip();

      drawWindowChrome(ctx, preset.theme, frameX, frameY, contentWidth);
      ctx.drawImage(image, frameX, frameY + chromeHeight, contentWidth, image.naturalHeight);

      if (preset.theme === "glass") {
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(frameX, frameY, contentWidth, contentHeight);
      }

      ctx.restore();
    },
    [image, preset]
  );

  React.useEffect(() => {
    render(Math.min(window.devicePixelRatio || 1, 2));
  }, [render]);

  const handleExport = async () => {
    if (!image || !canvasRef.current) return;
    setIsExporting(true);
    setError(null);
    try {
      // Re-render at the full requested export scale (preview may be capped lower).
      render(scale);
      const canvas = canvasRef.current;
      const mime = format === "png" ? "image/png" : "image/webp";
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), mime, format === "webp" ? 0.92 : undefined)
      );
      if (!blob) throw new Error("Export failed");

      const fileName = `screenshot-${Date.now()}.${format === "png" ? "png" : "webp"}`;
      downloadBlob(blob, fileName);
      await saveToolResult("screenshot-beautifier", {
        title: fileName,
        summary: `${THEMES.find((t) => t.value === preset.theme)?.label ?? preset.theme} · ${scale}x · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();

      // Restore the capped preview scale.
      render(Math.min(window.devicePixelRatio || 1, 2));
    } catch {
      setError("Could not export the image. Try a smaller scale.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!image && (
        <DropZone
          onFiles={handleFiles}
          accept="image/*"
          multiple={false}
          label="Drag & drop a screenshot here, click to browse, or paste with Ctrl+V"
          hint="macOS/Windows window frames, gradients, and shadows — all rendered locally"
        />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {image && (
        <EditorLayout
          stage={
            <FitStage width={image.naturalWidth + preset.padding * 2} height={image.naturalHeight + (preset.theme === "none" ? 0 : TITLEBAR_HEIGHT) + preset.padding * 2}>
              <canvas ref={canvasRef} className="block h-full w-full rounded-sm shadow-md" aria-label="Preview" />
            </FitStage>
          }
          stageToolbar={
            <span className="text-xs text-muted-foreground">
              Output {Math.round((image.naturalWidth + preset.padding * 2) * scale)} × {Math.round((image.naturalHeight + (preset.theme === "none" ? 0 : TITLEBAR_HEIGHT) + preset.padding * 2) * scale)}px at {scale}x
            </span>
          }
          sidebar={
            <>
              <SidebarSection title="Window theme">
                <div className="flex flex-wrap gap-1.5">
                  {THEMES.map((t) => (
                    <button key={t.value} onClick={() => setPreset((p) => ({ ...p, theme: t.value }))} aria-pressed={preset.theme === t.value} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${preset.theme === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </SidebarSection>
              <SidebarSection title="Shadow">
                <div className="flex flex-wrap gap-1.5">
                  {SHADOWS.map((sh) => (
                    <button key={sh.value} onClick={() => setPreset((p) => ({ ...p, shadow: sh.value }))} aria-pressed={preset.shadow === sh.value} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${preset.shadow === sh.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                      {sh.label}
                    </button>
                  ))}
                </div>
              </SidebarSection>
              <SidebarSection title="Size">
                <div className="space-y-3.5">
                  <SliderRow label="Padding" value={preset.padding} min={16} max={128} step={4} unit="px" onChange={(v) => setPreset((p) => ({ ...p, padding: v }))} />
                  <SliderRow label="Corner radius" value={preset.radius} min={0} max={32} unit="px" onChange={(v) => setPreset((p) => ({ ...p, radius: v }))} />
                </div>
              </SidebarSection>
              <SidebarSection title="Background">
                <div className="flex flex-wrap gap-2">
                  {BACKGROUNDS.map((bg) => (
                    <button key={bg.value} onClick={() => setPreset((p) => ({ ...p, background: bg.value }))} title={bg.label} aria-label={bg.label} aria-pressed={preset.background === bg.value} className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${preset.background === bg.value ? "border-primary ring-2 ring-primary/30" : "border-border"}`} style={{ background: bg.value }} />
                  ))}
                  <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-border text-xs text-muted-foreground hover:scale-110 hover:border-primary/50" title="Custom colour">
                    <input type="color" className="sr-only" aria-label="Custom background colour" onChange={(e) => setPreset((p) => ({ ...p, background: e.target.value }))} />+
                  </label>
                </div>
              </SidebarSection>
              <SidebarSection title="Export">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center overflow-hidden rounded-lg border border-border">
                    {(["png", "webp"] as ExportFormat[]).map((f) => (
                      <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f} className={`px-3 py-1.5 text-xs font-medium uppercase transition-colors ${format === f ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center overflow-hidden rounded-lg border border-border">
                    {([1, 2, 4] as ExportScale[]).map((sc) => (
                      <button key={sc} onClick={() => setScale(sc)} aria-pressed={scale === sc} className={`px-3 py-1.5 text-xs font-medium transition-colors ${scale === sc ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}>
                        {sc}x
                      </button>
                    ))}
                  </div>
                </div>
              </SidebarSection>
            </>
          }
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setImage(null)}>
                <ImageIcon className="h-3.5 w-3.5" /> New image
              </Button>
              <Button size="sm" className="ml-auto" onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Export
                  </>
                )}
              </Button>
            </>
          }
        />
      )}

      <ToolHistoryList ref={historyRef} toolSlug="screenshot-beautifier" />
    </div>
  );
}
