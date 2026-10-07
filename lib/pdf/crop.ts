import { PDFDocument } from "pdf-lib";
import { normalizeAngle } from "@/lib/pdf/rotation";

/** How much to remove from each edge of the page as displayed, as a fraction (0–0.9) of its width/height. */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_MARGINS: Margins = { top: 0, right: 0, bottom: 0, left: 0 };

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clampFraction = (n: number) => Math.min(0.9, Math.max(0, Number.isFinite(n) ? n : 0));

/** Keeps the margins from consuming the whole page (at least 10% must remain in each direction). */
export function clampMargins(m: Margins): Margins {
  let { top, right, bottom, left } = { top: clampFraction(m.top), right: clampFraction(m.right), bottom: clampFraction(m.bottom), left: clampFraction(m.left) };
  if (left + right > 0.9) {
    const k = 0.9 / (left + right);
    left *= k;
    right *= k;
  }
  if (top + bottom > 0.9) {
    const k = 0.9 / (top + bottom);
    top *= k;
    bottom *= k;
  }
  return { top, right, bottom, left };
}

/**
 * The crop box in PDF user space for margins given on the page as displayed. A page with /Rotate 90 shows
 * its user-space left edge at the top, so the displayed margins are mapped to the matching user-space edges.
 */
export function marginsToBox(box: Box, rotation: number, margins: Margins): Box {
  const m = clampMargins(margins);
  const rot = normalizeAngle(rotation);
  // fractions of the user-space width/height removed from each user-space edge
  let l: number, r: number, b: number, t: number;
  switch (rot) {
    case 90:
      [l, r, b, t] = [m.top, m.bottom, m.left, m.right];
      break;
    case 180:
      [l, r, b, t] = [m.right, m.left, m.top, m.bottom];
      break;
    case 270:
      [l, r, b, t] = [m.bottom, m.top, m.right, m.left];
      break;
    default:
      [l, r, b, t] = [m.left, m.right, m.bottom, m.top];
  }
  return {
    x: box.x + box.width * l,
    y: box.y + box.height * b,
    width: box.width * (1 - l - r),
    height: box.height * (1 - b - t),
  };
}

/** Sets the crop box of the chosen pages (0-based) to the given displayed margins. Page content is kept, just hidden. */
export async function cropPdf(bytes: Uint8Array, marginsByPage: Map<number, Margins>): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  for (const [index, margins] of marginsByPage) {
    const page = pages[index];
    if (!page) continue;
    // always crop from the full page, so cropping twice doesn't compound
    const media = page.getMediaBox();
    const box = marginsToBox(media, page.getRotation().angle, margins);
    page.setCropBox(box.x, box.y, box.width, box.height);
  }
  return doc.save();
}

/**
 * Finds the content area of a rendered page: the smallest box containing every pixel that isn't (almost)
 * white or transparent. Returns margins as fractions, with a little padding, or null for a blank page.
 */
export function detectContentMargins(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, options: { threshold?: number; padding?: number } = {}): Margins | null {
  const threshold = options.threshold ?? 245;
  const padding = options.padding ?? 0.01;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = rgba[i + 3];
      if (alpha < 16) continue;
      if (rgba[i] < threshold || rgba[i + 1] < threshold || rgba[i + 2] < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return clampMargins({
    left: Math.max(0, minX / width - padding),
    right: Math.max(0, (width - 1 - maxX) / width - padding),
    top: Math.max(0, minY / height - padding),
    bottom: Math.max(0, (height - 1 - maxY) / height - padding),
  });
}
