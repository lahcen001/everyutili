"use client";

import * as React from "react";
import JSZip from "jszip";
import { Download, Loader2 } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { buildHtmlSnippet, buildIco, buildManifest, placeSource, type FitMode } from "@/lib/favicon";
import { cn } from "@/lib/utils";

const PNG_FILES: { name: string; size: number }[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-48x48.png", size: 48 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];
const PREVIEW_SIZES = [16, 32, 48, 180];
const ICO_SIZES = [16, 32, 48];

interface RenderOptions {
  fit: FitMode;
  padding: number;
  /** null = transparent */
  background: string | null;
  rounded: number;
}

function renderCanvas(bitmap: ImageBitmap, size: number, o: RenderOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");
  const radius = (o.rounded / 100) * (size / 2);
  if (radius > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.clip();
  }
  if (o.background) {
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.imageSmoothingQuality = "high";
  const p = placeSource(bitmap.width, bitmap.height, size, o.fit, o.padding);
  ctx.drawImage(bitmap, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  return canvas;
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Render failed"))), "image/png"));

export default function FaviconGenerator() {
  useTrackTool("favicon-generator");
  const [bitmap, setBitmap] = React.useState<ImageBitmap | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fit, setFit] = React.useState<FitMode>("cover");
  const [padding, setPadding] = React.useState(0);
  const [transparent, setTransparent] = React.useState(true);
  const [background, setBackground] = React.useState("#ffffff");
  const [rounded, setRounded] = React.useState(0);
  const [appName, setAppName] = React.useState("My Website");
  const [themeColor, setThemeColor] = React.useState("#ffffff");
  const [previews, setPreviews] = React.useState<Record<number, string>>({});
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const bitmapRef = React.useRef<ImageBitmap | null>(null);

  const options: RenderOptions = { fit, padding, background: transparent ? null : background, rounded };
  const snippet = buildHtmlSnippet(themeColor);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    try {
      const img = await createImageBitmap(file);
      bitmapRef.current?.close();
      bitmapRef.current = img;
      setBitmap(img);
      setFileName(file.name);
      // Non-square sources look best letterboxed rather than cropped.
      setFit(Math.abs(img.width - img.height) > 2 ? "contain" : "cover");
    } catch {
      setError("This image couldn't be read. Try a PNG, JPG, WebP or SVG with a set size.");
    }
  };

  useIncomingHandoff((file) => void handleFiles([file]));

  React.useEffect(() => {
    return () => bitmapRef.current?.close();
  }, []);

  React.useEffect(() => {
    if (!bitmap) return;
    let cancelled = false;
    (async () => {
      const next: Record<number, string> = {};
      for (const size of PREVIEW_SIZES) next[size] = renderCanvas(bitmap, size, { fit, padding, background: transparent ? null : background, rounded }).toDataURL("image/png");
      await Promise.resolve();
      if (!cancelled) setPreviews(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [bitmap, fit, padding, transparent, background, rounded]);

  const generateZip = async () => {
    if (!bitmap) return;
    setIsGenerating(true);
    setError(null);
    try {
      const zip = new JSZip();
      const pngBySize = new Map<number, Uint8Array>();
      for (const { name, size } of PNG_FILES) {
        const blob = await toPng(renderCanvas(bitmap, size, options));
        zip.file(name, blob);
        pngBySize.set(size, new Uint8Array(await blob.arrayBuffer()));
      }
      zip.file("favicon.ico", buildIco(ICO_SIZES.map((size) => ({ size, png: pngBySize.get(size)! }))));
      zip.file("site.webmanifest", buildManifest({ name: appName || "My Website", shortName: appName, themeColor, backgroundColor: transparent ? "#ffffff" : background }));
      zip.file("favicon-snippet.html", `${snippet}\n`);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, "favicons.zip");
      await saveToolResult("favicon-generator", { title: "favicons.zip", summary: `${fileName ?? "source image"} → ICO + ${PNG_FILES.length} PNGs + manifest (${formatBytes(zipBlob.size)})`, blob: zipBlob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate favicons.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone onFiles={(f) => void handleFiles(f)} accept="image/*" multiple={false} label="Drag & drop a logo or image here, or click to browse" hint="Makes favicon.ico, PNGs (16–512 px), apple-touch-icon, a web manifest and the HTML tags" />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {bitmap && (
        <>
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Fit">
                {([["cover", "Fill (crop to square)"], ["contain", "Fit (keep whole image)"]] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setFit(id)} aria-pressed={fit === id} className={cn("px-3 py-1.5 font-medium transition-colors", fit === id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2">
                Padding
                <input type="range" min={0} max={40} value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="w-24 accent-primary" />
                <span className="w-8 text-muted-foreground">{padding}%</span>
              </label>
              <label className="flex items-center gap-2">
                Rounded corners
                <input type="range" min={0} max={100} value={rounded} onChange={(e) => setRounded(Number(e.target.value))} className="w-24 accent-primary" />
                <span className="w-10 text-muted-foreground">{rounded === 100 ? "circle" : `${rounded}%`}</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} className="h-4 w-4 rounded border-border" /> Transparent
                </label>
                {!transparent && <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} aria-label="Background colour" className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0" />}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {PREVIEW_SIZES.map((size) => (
                <div key={size} className="flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center rounded-lg border border-border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] p-1.5" style={{ width: Math.min(size, 96) + 12, height: Math.min(size, 96) + 12 }}>
                    {previews[size] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[size]} alt={`${size}px preview`} width={Math.min(size, 96)} height={Math.min(size, 96)} />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{size}px</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {fileName} · {bitmap.width}×{bitmap.height}px. Tip: a simple, square, high-contrast logo stays readable at 16 px.
            </p>
          </Card>

          <Card className="space-y-4 p-6">
            <p className="text-sm font-medium">Web app manifest</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">App / site name</span>
                <input value={appName} onChange={(e) => setAppName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Theme colour</span>
                <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="block h-10 w-full cursor-pointer rounded-lg border border-border bg-background" />
              </label>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Paste into your page&apos;s &lt;head&gt;</p>
                <CopyButton value={snippet} size="sm" variant="outline">
                  Copy
                </CopyButton>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/20 p-3 text-xs">{snippet}</pre>
              <p className="text-xs text-muted-foreground">Upload every file in the ZIP to your site&apos;s root so these paths work.</p>
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
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="favicon-generator" />
    </div>
  );
}
