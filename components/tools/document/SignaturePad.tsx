"use client";

import * as React from "react";
import { Eraser, ImageUp, PenLine, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { INK_COLORS, SIGNATURE_FONTS, imageToStamp, textToStamp, trimToPng, type StampImage } from "@/lib/pdf/stampImages";
import { cn } from "@/lib/utils";

type Mode = "draw" | "type" | "upload";

/** Pen thickness in canvas pixels (the pad is 900 px wide, drawn at about 560 on screen). */
const INK_WIDTH = 6;

/** Three ways to make a signature: draw it, type it in a handwriting style, or upload a picture. */
export function SignaturePad({ onCreate, label = "Use this signature" }: { onCreate: (image: StampImage) => void; label?: string }) {
  const [mode, setMode] = React.useState<Mode>("draw");
  const [color, setColor] = React.useState(INK_COLORS[0]);
  const [typed, setTyped] = React.useState("");
  const [fontId, setFontId] = React.useState(SIGNATURE_FONTS[0].id);
  const [uploaded, setUploaded] = React.useState<StampImage | null>(null);
  const [removeWhite, setRemoveWhite] = React.useState(true);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [hasInk, setHasInk] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef<{ p: { x: number; y: number }; mid: { x: number; y: number } } | null>(null);

  const font = SIGNATURE_FONTS.find((f) => f.id === fontId) ?? SIGNATURE_FONTS[0];
  const typedPreview = React.useMemo(() => (mode === "type" ? textToStamp(typed, font.css, color, 110, "italic") : null), [mode, typed, font, color]);

  React.useEffect(() => {
    if (!uploadFile) return;
    let cancelled = false;
    imageToStamp(uploadFile, removeWhite).then((s) => {
      if (!cancelled) setUploaded(s);
    });
    return () => {
      cancelled = true;
    };
  }, [uploadFile, removeWhite]);

  const toCanvas = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * canvas.width, y: ((clientY - rect.top) / rect.height) * canvas.height };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvas(e.currentTarget, e.clientX, e.clientY);
    drawing.current = { p, mid: p };
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, INK_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasInk(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drawing.current;
    if (!state) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = color;
    ctx.lineWidth = INK_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // use every point the browser collected since the last event, so fast strokes stay smooth
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      const p = toCanvas(canvas, ev.clientX, ev.clientY);
      const mid = { x: (state.p.x + p.x) / 2, y: (state.p.y + p.y) / 2 };
      // a curve from the previous midpoint to this one, bending toward the previous point: joined, no gaps
      ctx.beginPath();
      ctx.moveTo(state.mid.x, state.mid.y);
      ctx.quadraticCurveTo(state.p.x, state.p.y, mid.x, mid.y);
      ctx.stroke();
      state.p = p;
      state.mid = mid;
    }
  };
  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drawing.current;
    if (state) {
      // finish the last stretch up to the final point
      const ctx = e.currentTarget.getContext("2d")!;
      ctx.strokeStyle = color;
      ctx.lineWidth = INK_WIDTH;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(state.mid.x, state.mid.y);
      ctx.lineTo(state.p.x, state.p.y);
      ctx.stroke();
    }
    drawing.current = null;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const preview: StampImage | null = mode === "type" ? typedPreview : mode === "upload" ? uploaded : null;
  const finish = () => {
    const image = mode === "draw" ? (canvasRef.current ? trimToPng(canvasRef.current, 8) : null) : preview;
    if (image) onCreate(image);
  };
  const canUse = mode === "draw" ? hasInk : mode === "type" ? typed.trim() !== "" : uploaded !== null;

  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="tablist" aria-label="Signature method">
        {([["draw", "Draw", PenLine], ["type", "Type", Type], ["upload", "Upload", ImageUp]] as const).map(([id, text, Icon]) => (
          <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", mode === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
            <Icon className="h-3.5 w-3.5" /> {text}
          </button>
        ))}
      </div>

      {mode !== "upload" && (
        <div className="flex items-center gap-2" role="group" aria-label="Ink colour">
          {INK_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Ink ${c}`} aria-pressed={color === c} className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} />
          ))}
        </div>
      )}

      {mode === "draw" && (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={900}
            height={300}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Draw your signature here"
            className="h-40 w-full touch-none cursor-crosshair rounded-lg border border-dashed border-border bg-white"
          />
          <Button size="sm" variant="ghost" onClick={clear} disabled={!hasInk}>
            <Eraser className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}

      {mode === "type" && (
        <div className="space-y-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your name" aria-label="Your name" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Handwriting style">
            {SIGNATURE_FONTS.map((f) => (
              <button key={f.id} onClick={() => setFontId(f.id)} aria-pressed={fontId === f.id} className={cn("rounded-md border px-3 py-1.5 text-lg italic", fontId === f.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")} style={{ fontFamily: f.css }}>
                {typed.trim() || "Signature"}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "upload" && (
        <div className="space-y-2">
          <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Signature picture" onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); setUploaded(null); }} className="block text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={removeWhite} onChange={(e) => setRemoveWhite(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> Remove the white background
          </label>
          <p className="text-xs text-muted-foreground">Sign on plain white paper in good light, then photograph or scan it.</p>
        </div>
      )}

      {preview && (
        <div className="rounded-lg border border-border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:14px_14px] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.dataUrl} alt="Signature preview" className="mx-auto max-h-24" />
        </div>
      )}

      <Button onClick={finish} disabled={!canUse}>
        {label}
      </Button>
    </div>
  );
}
