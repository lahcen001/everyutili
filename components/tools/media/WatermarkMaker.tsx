"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, ImageIcon, Loader2, Stamp, Type, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EditorLayout, SidebarSection, SliderRow } from "@/components/tools/shared/EditorLayout";
import { FitStage } from "@/components/tools/shared/FitStage";
import { Progress } from "@/components/ui/progress";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

type WatermarkMode = "text" | "image";

type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const POSITIONS: { value: Position; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "center-left", label: "Center left" },
  { value: "center", label: "Center" },
  { value: "center-right", label: "Center right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
];

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  resultBlob?: Blob;
  resultName?: string;
  error?: string;
}

interface WatermarkOptions {
  mode: WatermarkMode;
  text: string;
  fontSize: number;
  textColor: string;
  textOpacity: number;
  logoOpacity: number;
  logoScale: number;
  position: Position;
  margin: number;
}

const DEFAULT_OPTIONS: WatermarkOptions = {
  mode: "text",
  text: "Your Watermark",
  fontSize: 32,
  textColor: "#ffffff",
  textOpacity: 80,
  logoOpacity: 80,
  logoScale: 20,
  position: "bottom-right",
  margin: 24,
};

/** Computes the draw origin for a watermark of given size within a canvas, honoring position + margin. */
function computeOrigin(
  canvasWidth: number,
  canvasHeight: number,
  boxWidth: number,
  boxHeight: number,
  position: Position,
  margin: number
): { x: number; y: number } {
  let x: number;
  let y: number;

  if (position.endsWith("left")) x = margin;
  else if (position.endsWith("right")) x = canvasWidth - boxWidth - margin;
  else x = (canvasWidth - boxWidth) / 2;

  if (position.startsWith("top")) y = margin;
  else if (position.startsWith("bottom")) y = canvasHeight - boxHeight - margin;
  else y = (canvasHeight - boxHeight) / 2;

  return { x, y };
}

function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

/** Draws the configured watermark onto ctx, sized for a canvas of canvasWidth x canvasHeight. */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  options: WatermarkOptions,
  logoImage: HTMLImageElement | null
) {
  if (options.mode === "text") {
    const text = options.text.trim();
    if (!text) return;
    ctx.save();
    ctx.globalAlpha = options.textOpacity / 100;
    ctx.fillStyle = options.textColor;
    ctx.font = `${options.fontSize}px sans-serif`;
    ctx.textBaseline = "top";
    const metrics = ctx.measureText(text);
    const boxWidth = metrics.width;
    const boxHeight = options.fontSize;
    const { x, y } = computeOrigin(canvasWidth, canvasHeight, boxWidth, boxHeight, options.position, options.margin);
    ctx.fillText(text, x, y);
    ctx.restore();
    return;
  }

  if (!logoImage) return;
  ctx.save();
  ctx.globalAlpha = options.logoOpacity / 100;
  const scaleRatio = options.logoScale / 100;
  const boxWidth = canvasWidth * scaleRatio;
  const boxHeight = boxWidth * (logoImage.naturalHeight / logoImage.naturalWidth);
  const { x, y } = computeOrigin(canvasWidth, canvasHeight, boxWidth, boxHeight, options.position, options.margin);
  ctx.drawImage(logoImage, x, y, boxWidth, boxHeight);
  ctx.restore();
}

export default function WatermarkMaker() {
  useTrackTool("watermark-maker");

  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [options, setOptions] = React.useState<WatermarkOptions>(DEFAULT_OPTIONS);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [previewImg, setPreviewImg] = React.useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = React.useState<HTMLImageElement | null>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const addMoreRef = React.useRef<HTMLInputElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const logoUrlRef = React.useRef<string | null>(null);

  const previewItem = queue.find((q) => q.id === previewId) ?? queue[0] ?? null;

  // Load the picture shown in the live preview.
  React.useEffect(() => {
    if (!previewItem) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    loadImageFromFile(previewItem.file)
      .then(({ img, url }) => {
        objectUrl = url;
        if (cancelled) URL.revokeObjectURL(url);
        else setPreviewImg(img);
      })
      .catch(() => {
        if (!cancelled) setPreviewImg(null);
      });
    return () => {
      cancelled = true;
      // keep the URL alive until the next image replaces it (the canvas has already copied the pixels)
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 1000);
    };
  }, [previewItem?.id, previewItem?.file]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the logo for the preview.
  React.useEffect(() => {
    if (!logoPreviewUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLogoImg(img);
    };
    img.src = logoPreviewUrl;
    return () => {
      cancelled = true;
    };
  }, [logoPreviewUrl]);

  // Draw the preview at the picture's real size, so the watermark looks exactly as it will in the result.
  React.useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !previewImg) return;
    canvas.width = previewImg.naturalWidth;
    canvas.height = previewImg.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(previewImg, 0, 0);
    drawWatermark(ctx, canvas.width, canvas.height, options, logoPreviewUrl ? logoImg : null);
  }, [previewImg, options, logoImg, logoPreviewUrl]);

  React.useEffect(() => {
    return () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    };
  }, []);

  const handleFiles = (files: File[]) => {
    const items: QueueItem[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, status: "pending" }));
    setQueue((prev) => [...prev, ...items]);
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  const removeItem = (id: string) => setQueue((prev) => prev.filter((item) => item.id !== id));

  const handleLogoFile = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) return;
    setError(null);
    if (logoUrlRef.current) {
      URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    logoUrlRef.current = url;
    setLogoFile(file);
    setLogoPreviewUrl(url);
  };

  const removeLogo = () => {
    if (logoUrlRef.current) {
      URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = null;
    }
    setLogoFile(null);
    setLogoPreviewUrl(null);
  };

  const processOne = async (item: QueueItem, logoImage: HTMLImageElement | null): Promise<QueueItem> => {
    try {
      const { img, url } = await loadImageFromFile(item.file);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not acquire canvas context");
        ctx.drawImage(img, 0, 0);
        drawWatermark(ctx, canvas.width, canvas.height, options, logoImage);

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png")
        );
        if (!blob) throw new Error("Export failed");

        const dotIndex = item.file.name.lastIndexOf(".");
        const baseName = dotIndex > 0 ? item.file.name.slice(0, dotIndex) : item.file.name;
        const resultName = `${baseName}-watermarked.png`;

        return { ...item, status: "done", resultBlob: blob, resultName };
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not process this image.";
      return { ...item, status: "error", error: message };
    }
  };

  const applyToAll = async () => {
    if (queue.length === 0) return;
    if (options.mode === "text" && !options.text.trim()) {
      setError("Enter watermark text or switch to an image watermark.");
      return;
    }
    if (options.mode === "image" && !logoFile) {
      setError("Upload a logo/image to use as the watermark.");
      return;
    }

    setError(null);
    setIsProcessing(true);

    let logoImage: HTMLImageElement | null = null;
    let logoObjectUrl: string | null = null;
    try {
      if (options.mode === "image" && logoFile) {
        const loaded = await loadImageFromFile(logoFile);
        logoImage = loaded.img;
        logoObjectUrl = loaded.url;
      }

      const pending = queue.filter((item) => item.status === "pending" || item.status === "error");

      for (const item of pending) {
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q)));
        const result = await processOne(item, logoImage);
        setQueue((prev) => prev.map((q) => (q.id === item.id ? result : q)));

        if (result.status === "done" && result.resultBlob && result.resultName) {
          await saveToolResult("watermark-maker", {
            title: result.resultName,
            summary: `${item.file.name} → ${formatBytes(result.resultBlob.size)}`,
            blob: result.resultBlob,
          });
          historyRef.current?.refresh();
        }
      }
    } finally {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
      setIsProcessing(false);
    }
  };

  const downloadAllAsZip = async () => {
    const done = queue.filter((item) => item.status === "done" && item.resultBlob);
    if (done.length === 0) return;
    const zip = new JSZip();
    done.forEach((item) => {
      if (item.resultBlob && item.resultName) zip.file(item.resultName, item.resultBlob);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "watermarked-images.zip");
  };

  const doneCount = queue.filter((item) => item.status === "done").length;
  const totalCount = queue.length;
  const progressPct = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;

  const textMode = options.mode === "text";
  const set = <K extends keyof WatermarkOptions>(key: K, value: WatermarkOptions[K]) => setOptions((o) => ({ ...o, [key]: value }));

  return (
    <div className="space-y-6">
      {queue.length === 0 && (
        <DropZone
          onFiles={handleFiles}
          accept="image/*"
          multiple
          label="Drag & drop images to watermark here, or click to browse"
          hint="Add a text or logo watermark to one image or a whole batch — live preview, all rendered locally"
        />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {queue.length > 0 && (
        <EditorLayout
          stage={
            previewImg ? (
              <FitStage width={previewImg.naturalWidth} height={previewImg.naturalHeight}>
                <canvas ref={previewCanvasRef} className="block h-full w-full bg-white shadow-md" aria-label="Watermark preview" />
              </FitStage>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )
          }
          stageToolbar={
            <>
              <div className="flex max-w-full flex-1 items-center gap-1.5 overflow-x-auto py-0.5" role="listbox" aria-label="Pick the picture to preview">
                {queue.map((item) => (
                  <button key={item.id} role="option" aria-selected={item.id === previewItem?.id} onClick={() => setPreviewId(item.id)} className={`shrink-0 rounded-md border px-2 py-1 text-xs ${item.id === previewItem?.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted"}`} title={item.file.name}>
                    <span className="block max-w-28 truncate">{item.file.name}</span>
                  </button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => addMoreRef.current?.click()}>
                Add more
              </Button>
              <input ref={addMoreRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            </>
          }
          sidebar={
            <>
              <SidebarSection title="Watermark type">
                <div className="flex overflow-hidden rounded-lg border border-border">
                  {([["text", "Text", Type], ["image", "Logo image", ImageIcon]] as const).map(([mode, label, Icon]) => (
                    <button key={mode} onClick={() => set("mode", mode)} aria-pressed={options.mode === mode} className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${options.mode === mode ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </SidebarSection>

              {textMode ? (
                <SidebarSection title="Text">
                  <input type="text" value={options.text} onChange={(e) => set("text", e.target.value)} placeholder="Your Watermark" aria-label="Watermark text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  <SliderRow label="Font size" value={options.fontSize} min={8} max={200} unit="px" onChange={(v) => set("fontSize", v)} />
                  <SliderRow label="Opacity" value={options.textOpacity} min={0} max={100} unit="%" onChange={(v) => set("textOpacity", v)} />
                  <label className="flex items-center justify-between text-sm">
                    <span className="font-medium">Colour</span>
                    <input type="color" value={options.textColor} onChange={(e) => set("textColor", e.target.value)} aria-label="Text colour" className="h-8 w-14 cursor-pointer rounded border border-border bg-transparent" />
                  </label>
                </SidebarSection>
              ) : (
                <SidebarSection title="Logo">
                  {logoPreviewUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreviewUrl} alt="Watermark logo preview" className="h-12 w-12 rounded-md border border-border bg-white object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{logoFile?.name}</p>
                        <p className="text-xs text-muted-foreground">{logoFile ? formatBytes(logoFile.size) : ""}</p>
                      </div>
                      <button onClick={() => { removeLogo(); setLogoImg(null); }} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove logo">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <DropZone onFiles={handleLogoFile} accept="image/*" multiple={false} label="Drop a logo, or click" hint="PNG with transparency works best" className="py-4" />
                  )}
                  <SliderRow label="Size" value={options.logoScale} min={2} max={80} unit="%" onChange={(v) => set("logoScale", v)} />
                  <SliderRow label="Opacity" value={options.logoOpacity} min={0} max={100} unit="%" onChange={(v) => set("logoOpacity", v)} />
                </SidebarSection>
              )}

              <SidebarSection title="Position">
                <div className="flex items-center gap-4">
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1" role="radiogroup" aria-label="Position">
                    {POSITIONS.map((pos) => (
                      <button key={pos.value} role="radio" aria-checked={options.position === pos.value} onClick={() => set("position", pos.value)} title={pos.label} aria-label={pos.label} className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${options.position === pos.value ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      </button>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SliderRow label="Margin" value={options.margin} min={0} max={200} step={2} unit="px" onChange={(v) => set("margin", v)} />
                  </div>
                </div>
              </SidebarSection>
            </>
          }
          footer={
            <>
              <Button className="flex-1" onClick={applyToAll} disabled={isProcessing || queue.length === 0}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Applying…
                  </>
                ) : (
                  <>
                    <Stamp className="h-4 w-4" /> Apply to {queue.length === 1 ? "image" : `all ${queue.length}`}
                  </>
                )}
              </Button>
              {doneCount > 0 && (
                <Button variant="outline" onClick={downloadAllAsZip}>
                  <Download className="h-4 w-4" /> ZIP ({doneCount})
                </Button>
              )}
            </>
          }
        />
      )}

      {totalCount > 0 && (
        <>
          <Progress value={progressPct} aria-label="Watermarking progress" />

          <div className="grid gap-2">
            {queue.map((item) => (
              <QueueRow key={item.id} item={item} onRemove={() => removeItem(item.id)} />
            ))}
          </div>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="watermark-maker" />
    </div>
  );
}

function QueueRow({ item, onRemove }: { item: QueueItem; onRemove: () => void }) {
  const thumbUrl = React.useMemo(() => URL.createObjectURL(item.file), [item.file]);

  React.useEffect(() => {
    return () => URL.revokeObjectURL(thumbUrl);
  }, [thumbUrl]);

  return (
    <Card className="flex items-center gap-3 p-3">
      <img src={thumbUrl} alt="" className="h-10 w-10 shrink-0 rounded-md border border-border object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(item.file.size)}
          {item.status === "done" && item.resultBlob && (
            <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">
              → {formatBytes(item.resultBlob.size)}
            </span>
          )}
          {item.status === "error" && <span className="ml-2 text-destructive">{item.error}</span>}
        </p>
      </div>
      {item.status === "processing" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
      {item.status === "done" && item.resultBlob && item.resultName && (
        <Button size="sm" variant="outline" onClick={() => downloadBlob(item.resultBlob!, item.resultName!)}>
          <Download className="h-3.5 w-3.5" /> Save
        </Button>
      )}
      <button
        onClick={onRemove}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Remove file"
      >
        <X className="h-4 w-4" />
      </button>
    </Card>
  );
}
