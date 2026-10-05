"use client";

import * as React from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { Download, ImageIcon, Loader2, Stamp, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { normalizeAngle, visualToUser } from "@/lib/pdf/rotation";
import { watermarkPlacements, type WatermarkPosition } from "@/lib/pdf/watermark";
import { formatBytes } from "@/lib/format";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: "top-left", label: "↖" },
  { id: "top-center", label: "↑" },
  { id: "top-right", label: "↗" },
  { id: "middle-left", label: "←" },
  { id: "center", label: "●" },
  { id: "middle-right", label: "→" },
  { id: "bottom-left", label: "↙" },
  { id: "bottom-center", label: "↓" },
  { id: "bottom-right", label: "↘" },
];

interface PagePreview {
  canvas: HTMLCanvasElement;
  widthPt: number;
  heightPt: number;
}

/** Draws text to a transparent canvas through the browser, so every script (Arabic, CJK…) works. */
function renderTextCanvas(text: string, color: string, bold: boolean): HTMLCanvasElement {
  const fontSize = 160;
  const font = `${bold ? "700" : "400"} ${fontSize}px system-ui, "Segoe UI", Arial, sans-serif`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const lines = text.split("\n").filter((l) => l.length > 0);
  const lineHeight = fontSize * 1.25;
  const width = Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width), 1)) + 40;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.ceil(lineHeight * lines.length) + 20;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => ctx.fillText(line, width / 2, 10 + lineHeight * (i + 0.5)));
  return canvas;
}

async function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

const toPngBytes = (canvas: HTMLCanvasElement) =>
  new Promise<ArrayBuffer>((resolve, reject) =>
    canvas.toBlob((b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error("Could not encode the watermark"))), "image/png")
  );

export default function WatermarkPdf() {
  useTrackTool("watermark-pdf");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [preview, setPreview] = React.useState<PagePreview | null>(null);
  const [kind, setKind] = React.useState<"text" | "image">("text");
  const [text, setText] = React.useState("CONFIDENTIAL");
  const [color, setColor] = React.useState("#b91c1c");
  const [bold, setBold] = React.useState(true);
  const [imageCanvas, setImageCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const [position, setPosition] = React.useState<WatermarkPosition>("center");
  const [tiled, setTiled] = React.useState(false);
  const [sizePct, setSizePct] = React.useState(60);
  const [opacity, setOpacity] = React.useState(0.25);
  const [rotation, setRotation] = React.useState(45);
  const [rangeText, setRangeText] = React.useState("");
  const [isWorking, setIsWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const effectivePosition: WatermarkPosition = tiled ? "tiled" : position;
  const range = parsePageRanges(rangeText, pageCount);

  const markCanvas = React.useMemo(
    () => (kind === "text" ? (text.trim() ? renderTextCanvas(text, color, bold) : null) : imageCanvas),
    [kind, text, color, bold, imageCanvas]
  );

  const loadPdf = async (files: File[]) => {
    const pdfFile = files.find((f) => isPdfFile(f));
    if (!pdfFile) return;
    setError(null);
    try {
      const bytes = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdfjsLib.getDocument({ data: bytes.slice(0) });
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 520 / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      await task.destroy();
      setPreview({ canvas, widthPt: base.width, heightPt: base.height });
      setPageCount(doc.getPageCount());
      setFile(pdfFile);
    } catch (e) {
      setError(friendlyPdfError(e, "Could not open this PDF."));
    }
  };

  const loadImage = async (files: File[]) => {
    const image = files.find((f) => f.type.startsWith("image/"));
    if (!image) return;
    try {
      setImageCanvas(await imageFileToCanvas(image));
      setKind("image");
      setError(null);
    } catch {
      setError("Could not read this image.");
    }
  };

  // Live preview: page 1 with the watermark drawn from the exact same placements the export uses.
  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !preview) return;
    canvas.width = preview.canvas.width;
    canvas.height = preview.canvas.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(preview.canvas, 0, 0);
    if (!markCanvas) return;
    const scale = canvas.width / preview.widthPt;
    const wmW = (preview.widthPt * sizePct) / 100;
    const wmH = wmW * (markCanvas.height / markCanvas.width);
    const placements = watermarkPlacements({ pageWidth: preview.widthPt, pageHeight: preview.heightPt, width: wmW, height: wmH, position: effectivePosition, rotation });
    ctx.globalAlpha = opacity;
    for (const p of placements) {
      const t = (p.rotation * Math.PI) / 180;
      const cx = p.x + (wmW / 2) * Math.cos(t) - (wmH / 2) * Math.sin(t);
      const cy = p.y + (wmW / 2) * Math.sin(t) + (wmH / 2) * Math.cos(t);
      ctx.save();
      ctx.translate(cx * scale, canvas.height - cy * scale);
      ctx.rotate(-t);
      ctx.drawImage(markCanvas, (-wmW / 2) * scale, (-wmH / 2) * scale, wmW * scale, wmH * scale);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }, [preview, markCanvas, sizePct, opacity, rotation, effectivePosition]);

  const apply = async () => {
    if (!file || !markCanvas) return;
    if (range.error || range.pages.length === 0) {
      setError(range.error ?? "No pages selected.");
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const image = await pdf.embedPng(await toPngBytes(markCanvas));
      const targets = new Set(range.pages);
      pdf.getPages().forEach((page, index) => {
        if (!targets.has(index + 1)) return;
        const { width: W, height: H } = page.getSize();
        const pageRotation = normalizeAngle(page.getRotation().angle);
        const sideways = pageRotation === 90 || pageRotation === 270;
        const vw = sideways ? H : W;
        const vh = sideways ? W : H;
        const wmW = (vw * sizePct) / 100;
        const wmH = wmW * (markCanvas.height / markCanvas.width);
        for (const p of watermarkPlacements({ pageWidth: vw, pageHeight: vh, width: wmW, height: wmH, position: effectivePosition, rotation })) {
          const origin = visualToUser(p.x, p.y, W, H, pageRotation);
          page.drawImage(image, { x: origin.x, y: origin.y, width: wmW, height: wmH, rotate: degrees(p.rotation + pageRotation), opacity });
        }
      });
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `${file.name.replace(/\.pdf$/i, "")}-watermarked.pdf`;
      downloadBlob(blob, name);
      await saveToolResult("watermark-pdf", { title: name, summary: `${targets.size} of ${pageCount} pages · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to add the watermark."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone onFiles={loadPdf} accept="application/pdf" multiple={false} label="Drag & drop a PDF here, or click to browse" hint="Stamp a text or image watermark on some or all pages" />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && preview && (
        <>
          <Card className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · {pageCount} page{pageCount === 1 ? "" : "s"}
              </p>
            </div>
            <button onClick={() => { setFile(null); setPreview(null); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
              <X className="h-4 w-4" />
            </button>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
            <Card className="space-y-4 p-4">
              <div className="flex gap-1" role="tablist" aria-label="Watermark type">
                {(["text", "image"] as const).map((k) => (
                  <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("rounded-md px-3 py-1 text-sm font-medium", kind === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                    {k === "text" ? "Text" : "Image"}
                  </button>
                ))}
              </div>

              {kind === "text" ? (
                <div className="space-y-3">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Watermark text" className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      Color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-border bg-background p-0.5" />
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} className="h-4 w-4 rounded border-border" /> Bold
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <DropZone onFiles={loadImage} accept="image/*" multiple={false} label="Drop a logo or image (PNG, JPG, WebP…)" hint="Transparent PNGs work best" />
                  {imageCanvas && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" /> Image loaded ({imageCanvas.width}×{imageCanvas.height})
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Size: {sizePct}% of page width</span>
                  <input type="range" min={5} max={100} value={sizePct} onChange={(e) => setSizePct(Number(e.target.value))} className="block w-full" aria-label="Watermark size" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Opacity: {Math.round(opacity * 100)}%</span>
                  <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="block w-full" aria-label="Watermark opacity" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Rotation: {rotation}°</span>
                  <input type="range" min={-90} max={90} step={5} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="block w-full" aria-label="Watermark rotation" />
                </label>
              </div>

              <div className="flex flex-wrap items-start gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Position</p>
                  <div className={cn("grid w-fit grid-cols-3 gap-1", tiled && "opacity-40")} role="group" aria-label="Watermark position">
                    {POSITIONS.map((p) => (
                      <button key={p.id} onClick={() => setPosition(p.id)} disabled={tiled} aria-pressed={position === p.id && !tiled} className={cn("h-8 w-8 rounded-md border text-sm", position === p.id && !tiled ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={tiled} onChange={(e) => { setTiled(e.target.checked); if (e.target.checked) setSizePct((s) => Math.min(s, 30)); }} className="h-4 w-4 rounded border-border" />
                    Repeat across the whole page
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Pages</span>
                    <input value={rangeText} onChange={(e) => setRangeText(e.target.value)} placeholder="All — or e.g. 2-5, 9" aria-label="Pages to watermark" className="h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                    <span className={cn("block text-xs", range.error ? "text-destructive" : "text-muted-foreground")}>{range.error ?? `${range.pages.length} of ${pageCount} pages`}</span>
                  </label>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <p className="text-sm font-medium">Preview (page 1)</p>
              <canvas ref={previewRef} className="w-full rounded-lg border border-border bg-white shadow-sm" aria-label="Watermark preview on page 1" />
            </div>
          </div>

          <Button onClick={apply} disabled={isWorking || !markCanvas || Boolean(range.error)}>
            {isWorking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adding watermark…
              </>
            ) : (
              <>
                <Stamp className="h-4 w-4" /> <Download className="h-4 w-4" /> Add Watermark & Download
              </>
            )}
          </Button>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="watermark-pdf" />
    </div>
  );
}
