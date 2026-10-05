export type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "tiled";

export interface WatermarkPlacement {
  /** Bottom-left origin to pass to pdf-lib's drawImage together with `rotation`. */
  x: number;
  y: number;
  /** Degrees, counter-clockwise (PDF convention). */
  rotation: number;
}

/**
 * pdf-lib rotates an image around its bottom-left corner. To rotate around the image's centre
 * instead, move the origin so the centre lands on (cx, cy).
 */
export function originForCentre(cx: number, cy: number, width: number, height: number, rotationDeg: number): { x: number; y: number } {
  const t = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return { x: cx - ((width / 2) * cos - (height / 2) * sin), y: cy - ((width / 2) * sin + (height / 2) * cos) };
}

/** Where to draw a `width`×`height` watermark on a page, in PDF points. Tiled covers the whole page. */
export function watermarkPlacements(opts: {
  pageWidth: number;
  pageHeight: number;
  width: number;
  height: number;
  position: WatermarkPosition;
  rotation: number;
  margin?: number;
  /** Extra space between tiles, as a fraction of the watermark size. */
  tileGap?: number;
}): WatermarkPlacement[] {
  const { pageWidth: W, pageHeight: H, width: w, height: h, position, rotation } = opts;
  const margin = opts.margin ?? 36;
  const place = (cx: number, cy: number): WatermarkPlacement => ({ ...originForCentre(cx, cy, w, h, rotation), rotation });

  if (position === "tiled") {
    const gap = opts.tileGap ?? 0.8;
    const stepX = Math.max(10, w * (1 + gap));
    const stepY = Math.max(10, h * (1 + gap));
    const out: WatermarkPlacement[] = [];
    // Start a little outside the page so rotated tiles still reach the edges.
    for (let row = 0, cy = -stepY / 2; cy < H + stepY; row++, cy += stepY) {
      const offset = row % 2 === 0 ? 0 : stepX / 2;
      for (let cx = -stepX / 2 + offset; cx < W + stepX; cx += stepX) out.push(place(cx, cy));
    }
    return out;
  }

  // Keep the visual bounding box of the (rotated) watermark inside the margins.
  const t = (rotation * Math.PI) / 180;
  const boxW = Math.abs(w * Math.cos(t)) + Math.abs(h * Math.sin(t));
  const boxH = Math.abs(w * Math.sin(t)) + Math.abs(h * Math.cos(t));
  const left = margin + boxW / 2;
  const right = W - margin - boxW / 2;
  const bottom = margin + boxH / 2;
  const top = H - margin - boxH / 2;
  const cxFor = position.endsWith("left") ? left : position.endsWith("right") ? right : W / 2;
  const cyFor = position.startsWith("top") ? top : position.startsWith("bottom") ? bottom : H / 2;
  return [place(cxFor, cyFor)];
}
