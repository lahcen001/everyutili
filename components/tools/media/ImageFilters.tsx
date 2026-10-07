"use client";

import * as React from "react";
import { Download, Eye, ImageIcon, Loader2, RotateCcw } from "lucide-react";

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
  const [showOriginal, setShowOriginal] = React.useState(false);
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

  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = showOriginal ? "none" : buildFilterString(filters);
    ctx.drawImage(image, 0, 0);
    ctx.filter = "none";
  }, [image, filters, showOriginal]);

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
      setShowOriginal(false);
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
        <EditorLayout
          stage={
            <FitStage width={image.naturalWidth} height={image.naturalHeight}>
              <canvas ref={canvasRef} className="block h-full w-full rounded-sm bg-white shadow-md" aria-label="Image preview" />
            </FitStage>
          }
          stageToolbar={
            <>
              <button
                onPointerDown={() => setShowOriginal(true)}
                onPointerUp={() => setShowOriginal(false)}
                onPointerLeave={() => setShowOriginal(false)}
                onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setShowOriginal(true)}
                onKeyUp={() => setShowOriginal(false)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                title="Hold to see the original"
              >
                <Eye className="h-3.5 w-3.5" /> Hold to compare
              </button>
              <span className="text-xs text-muted-foreground">
                {image.naturalWidth} × {image.naturalHeight}px{showOriginal ? " — original" : ""}
              </span>
            </>
          }
          sidebar={
            <>
              <SidebarSection title="Presets">
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((preset) => (
                    <button key={preset.name} onClick={() => applyPreset(preset)} className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-muted">
                      {preset.name}
                    </button>
                  ))}
                </div>
              </SidebarSection>
              <SidebarSection title="Adjust" action={<button onClick={resetFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" /> Reset</button>}>
                <div className="space-y-3.5">
                  {SLIDERS.map((slider) => (
                    <SliderRow key={slider.key} label={slider.label} value={filters[slider.key]} min={slider.min} max={slider.max} step={slider.step} unit={slider.unit} onChange={(v) => setFilters((f) => ({ ...f, [slider.key]: v }))} />
                  ))}
                </div>
              </SidebarSection>
              <SidebarSection title="Export as">
                <div className="flex w-fit items-center overflow-hidden rounded-lg border border-border">
                  {(["png", "webp"] as ExportFormat[]).map((f) => (
                    <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f} className={`px-3 py-1.5 text-xs font-medium uppercase transition-colors ${format === f ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}>
                      {f}
                    </button>
                  ))}
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

      <ToolHistoryList ref={historyRef} toolSlug="image-filters" />
    </div>
  );
}
