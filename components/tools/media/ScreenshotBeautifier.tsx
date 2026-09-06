"use client";

import * as React from "react";
import { Download, ImageIcon, Loader2 } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      canvas.style.width = "100%";
      canvas.style.aspectRatio = `${outWidth} / ${outHeight}`;

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
        <>
          <Card className="overflow-hidden p-0">
            <canvas ref={canvasRef} className="block w-full" />
          </Card>

          <Card className="space-y-5 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Window theme</span>
                <div className="flex flex-wrap gap-1 overflow-hidden rounded-lg border border-border">
                  {THEMES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setPreset((p) => ({ ...p, theme: t.value }))}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        preset.theme === t.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent hover:bg-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Shadow depth</span>
                <div className="flex flex-wrap gap-1 overflow-hidden rounded-lg border border-border">
                  {SHADOWS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setPreset((p) => ({ ...p, shadow: s.value }))}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        preset.shadow === s.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent hover:bg-muted"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-sm font-medium">Padding</span>
                <input
                  type="range"
                  min={16}
                  max={128}
                  step={4}
                  value={preset.padding}
                  onChange={(e) => setPreset((p) => ({ ...p, padding: Number(e.target.value) }))}
                  className="flex-1 accent-primary"
                />
                <span className="w-12 text-right text-sm text-muted-foreground">{preset.padding}px</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-sm font-medium">Radius</span>
                <input
                  type="range"
                  min={0}
                  max={32}
                  step={1}
                  value={preset.radius}
                  onChange={(e) => setPreset((p) => ({ ...p, radius: Number(e.target.value) }))}
                  className="flex-1 accent-primary"
                />
                <span className="w-12 text-right text-sm text-muted-foreground">{preset.radius}px</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Background</span>
              <div className="flex flex-wrap gap-2">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.value}
                    onClick={() => setPreset((p) => ({ ...p, background: bg.value }))}
                    title={bg.label}
                    aria-label={bg.label}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      preset.background === bg.value ? "border-primary" : "border-border"
                    }`}
                    style={{ background: bg.value }}
                  />
                ))}
                <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-border text-xs text-muted-foreground hover:scale-110 hover:border-primary/50">
                  <input
                    type="color"
                    className="sr-only"
                    onChange={(e) => setPreset((p) => ({ ...p, background: e.target.value }))}
                  />
                  +
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-1 overflow-hidden rounded-lg border border-border">
                {(["png", "webp"] as ExportFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
                      format === f ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 overflow-hidden rounded-lg border border-border">
                {([1, 2, 4] as ExportScale[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      scale === s ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setImage(null)}>
                  <ImageIcon className="h-3.5 w-3.5" /> New image
                </Button>
                <Button size="sm" onClick={handleExport} disabled={isExporting}>
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
              </div>
            </div>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="screenshot-beautifier" />
    </div>
  );
}
