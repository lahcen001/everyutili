export interface TextWatermark {
  enabled: boolean;
  text: string;
  /** 0–1 */
  opacity: number;
  /** degrees, counter-clockwise looks like a diagonal stamp at 45 */
  angle: number;
  /** hex without # */
  color: string;
  /** text size as a fraction of the page width (0.05–0.3) */
  size: number;
}

export const DEFAULT_WATERMARK: TextWatermark = { enabled: false, text: "DRAFT", opacity: 0.12, angle: 45, color: "6B7280", size: 0.16 };

/**
 * A transparent PNG the size of a page with the watermark text centred and rotated. Drawn on a canvas so any
 * script works, and the same image is used for the on-screen preview and the exported PDF.
 */
export function watermarkDataUrl(w: TextWatermark, widthPx: number, heightPx: number): string | null {
  if (!w.enabled || !w.text.trim() || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthPx);
  canvas.height = Math.round(heightPx);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-w.angle * Math.PI) / 180);
  ctx.globalAlpha = Math.min(1, Math.max(0.02, w.opacity));
  ctx.fillStyle = `#${w.color}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = Math.max(12, canvas.width * Math.min(0.3, Math.max(0.05, w.size)));
  const font = (px: number) => `700 ${px}px system-ui, -apple-system, 'Segoe UI', Arial, sans-serif`;
  ctx.font = font(size);
  // never wider than the page diagonal
  const limit = Math.hypot(canvas.width, canvas.height) * 0.9;
  const measured = ctx.measureText(w.text.trim()).width;
  if (measured > limit) {
    size *= limit / measured;
    ctx.font = font(size);
  }
  ctx.fillText(w.text.trim(), 0, 0);
  return canvas.toDataURL("image/png");
}
