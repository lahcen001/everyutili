"use client";

import * as React from "react";
import { Download, ImageIcon, Loader2, RotateCcw } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

interface Filters {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
  hueRotate: number;
  sepia: number;
  grayscale: number;
  invert: number;
}

const NEUTRAL_FILTERS: Filters = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  blur: 0,
  hueRotate: 0,
  sepia: 0,
  grayscale: 0,
  invert: 0,
};

interface SliderDef {
  key: keyof Filters;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: SliderDef[] = [
  { key: "brightness", label: "Brightness", min: 0, max: 200, step: 1, unit: "%" },
  { key: "contrast", label: "Contrast", min: 0, max: 200, step: 1, unit: "%" },
  { key: "saturate", label: "Saturation", min: 0, max: 200, step: 1, unit: "%" },
  { key: "blur", label: "Blur", min: 0, max: 20, step: 0.5, unit: "px" },
  { key: "hueRotate", label: "Hue Rotate", min: 0, max: 360, step: 1, unit: "deg" },
  { key: "sepia", label: "Sepia", min: 0, max: 100, step: 1, unit: "%" },
  { key: "grayscale", label: "Grayscale", min: 0, max: 100, step: 1, unit: "%" },
  { key: "invert", label: "Invert", min: 0, max: 100, step: 1, unit: "%" },
];

interface Preset {
  name: string;
  filters: Partial<Filters>;
}

const PRESETS: Preset[] = [
  { name: "Original", filters: {} },
  { name: "Vivid", filters: { contrast: 125, saturate: 150, brightness: 105 } },
  { name: "B&W", filters: { grayscale: 100, contrast: 110 } },
  { name: "Vintage", filters: { sepia: 60, contrast: 90, brightness: 105, saturate: 85 } },
  { name: "Cool", filters: { hueRotate: 190, saturate: 110, brightness: 100 } },
  { name: "Warm", filters: { hueRotate: 320, saturate: 115, sepia: 15 } },
  { name: "Noir", filters: { grayscale: 100, contrast: 140, brightness: 90 } },
];

type ExportFormat = "png" | "webp";

function buildFilterString(filters: Filters): string {
  return [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    `saturate(${filters.saturate}%)`,
    `blur(${filters.blur}px)`,
    `hue-rotate(${filters.hueRotate}deg)`,
    `sepia(${filters.sepia}%)`,
    `grayscale(${filters.grayscale}%)`,
    `invert(${filters.invert}%)`,
  ].join(" ");
}

export default function ImageFilters() {
  useTrackTool("image-filters");

  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = React.useState<Filters>(NEUTRAL_FILTERS);
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
    img.onload = () => {
      setImage(img);
      setFilters(NEUTRAL_FILTERS);
    };
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

  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.style.width = "100%";
    canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = buildFilterString(filters);
    ctx.drawImage(image, 0, 0);
    ctx.filter = "none";
  }, [image, filters]);

  React.useEffect(() => {
    render();
  }, [render]);

  const applyPreset = (preset: Preset) => {
    setFilters({ ...NEUTRAL_FILTERS, ...preset.filters });
  };

  const resetFilters = () => setFilters(NEUTRAL_FILTERS);

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    setIsExporting(true);
    setError(null);
    try {
      render();
      const mime = format === "png" ? "image/png" : "image/webp";
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), mime, format === "webp" ? 0.92 : undefined)
      );
      if (!blob) throw new Error("Export failed");

      const fileName = `filtered-${Date.now()}.${format}`;
      downloadBlob(blob, fileName);
      await saveToolResult("image-filters", {
        title: fileName,
        summary: `${format.toUpperCase()} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch {
      setError("Could not export the image.");
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
          label="Drag & drop an image here, click to browse, or paste with Ctrl+V"
          hint="Adjust brightness, contrast, color grading and more — all rendered locally"
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
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Presets</span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-muted"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              {SLIDERS.map((slider) => (
                <div key={slider.key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm font-medium">{slider.label}</span>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={filters[slider.key]}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, [slider.key]: Number(e.target.value) }))
                    }
                    className="flex-1 accent-primary"
                  />
                  <span className="w-14 text-right text-sm text-muted-foreground">
                    {filters[slider.key]}
                    {slider.unit}
                  </span>
                </div>
              ))}
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

              <Button variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>

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

      <ToolHistoryList ref={historyRef} toolSlug="image-filters" />
    </div>
  );
}
