import { opaqueBounds, whiteToTransparent } from "@/lib/pdf/stamp";

export interface SignatureFont {
  id: string;
  label: string;
  css: string;
}

/** Script-style faces most systems have, with graceful fallbacks. */
export const SIGNATURE_FONTS: SignatureFont[] = [
  { id: "classic", label: "Classic", css: "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive" },
  { id: "casual", label: "Casual", css: "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive" },
  { id: "formal", label: "Formal", css: "'Apple Chancery', 'Lucida Calligraphy', 'URW Chancery L', Georgia, serif" },
  { id: "plain", label: "Plain", css: "'Helvetica Neue', Arial, sans-serif" },
];

export const INK_COLORS = ["#111827", "#1d4ed8", "#b91c1c", "#047857"];

export interface StampImage {
  dataUrl: string;
  /** height divided by width */
  aspect: number;
}

/** Crops transparent margins (keeping a little padding) and returns a PNG. */
export function trimToPng(canvas: HTMLCanvasElement, padding = 6): StampImage | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = opaqueBounds(data.data, canvas.width, canvas.height);
  if (!bounds) return null;
  const x = Math.max(0, bounds.x - padding);
  const y = Math.max(0, bounds.y - padding);
  const w = Math.min(canvas.width - x, bounds.w + padding * 2);
  const h = Math.min(canvas.height - y, bounds.h + padding * 2);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return { dataUrl: out.toDataURL("image/png"), aspect: h / w };
}

/** Renders text in any script to a transparent PNG. */
export function textToStamp(text: string, font: string, color: string, sizePx = 120, style = ""): StampImage | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${style} ${sizePx}px ${font}`;
  const width = Math.ceil(measure.measureText(trimmed).width) + sizePx;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(40, width);
  canvas.height = Math.ceil(sizePx * 1.8);
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${style} ${sizePx}px ${font}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(trimmed, sizePx / 2, canvas.height / 2);
  return trimToPng(canvas);
}

/** A picture of a signature (scan or photo) with its white paper removed. */
export async function imageToStamp(file: File, removeWhite: boolean): Promise<StampImage | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  if (removeWhite) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    whiteToTransparent(data.data);
    ctx.putImageData(data, 0, 0);
  }
  return trimToPng(canvas, 4);
}
