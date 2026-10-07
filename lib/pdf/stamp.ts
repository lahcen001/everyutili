import { PDFDocument, degrees } from "pdf-lib";
import { normalizeAngle, visualToUser } from "@/lib/pdf/rotation";

/** Where a stamp (signature, date, text) sits on a page, as fractions of the page as displayed, measured from the top-left. */
export interface StampPlacement {
  x: number;
  y: number;
  /** width as a fraction of the displayed page width */
  w: number;
  /** height as a fraction of the displayed page height */
  h: number;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** drawImage rotation in degrees, counter-clockwise, about (x, y) */
  rotate: number;
}

/**
 * Converts a placement on the displayed page to the box and rotation pdf-lib needs, for any /Rotate.
 * `box` is the visible page area in user space (the crop box, or media box) and `rotation` the page's /Rotate.
 */
export function placementToPdf(p: StampPlacement, box: { x: number; y: number; width: number; height: number }, rotation: number): PdfRect {
  const rot = normalizeAngle(rotation);
  const displayedW = rot % 180 === 0 ? box.width : box.height;
  const displayedH = rot % 180 === 0 ? box.height : box.width;
  const width = p.w * displayedW;
  const height = p.h * displayedH;
  // lower-left corner of the stamp, in displayed coordinates with the origin at the bottom-left
  const sx = p.x * displayedW;
  const sy = displayedH - (p.y * displayedH + height);
  const user = visualToUser(sx, sy, box.width, box.height, rot);
  return { x: user.x + box.x, y: user.y + box.y, width, height, rotate: rot };
}

export interface StampImage {
  png: Uint8Array;
  placement: StampPlacement;
  /** 0-based pages this stamp goes on */
  pages: number[];
}

/** Draws PNG stamps onto the chosen pages. */
export async function applyStamps(pdfBytes: Uint8Array, stamps: StampImage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const pages = doc.getPages();
  for (const stamp of stamps) {
    const image = await doc.embedPng(stamp.png);
    for (const index of stamp.pages) {
      const page = pages[index];
      if (!page) continue;
      const box = page.getCropBox();
      const rect = placementToPdf(stamp.placement, box, page.getRotation().angle);
      page.drawImage(image, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, rotate: degrees(rect.rotate) });
    }
  }
  return doc.save();
}

/* --------------------------------------------------------- image helpers */

/** The tight box around pixels that aren't (nearly) transparent. null if the image is empty. */
export function opaqueBounds(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, alphaThreshold = 10): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Makes a scanned or photographed signature usable: near-white pixels become transparent, and darker
 * pixels keep their colour with alpha rising as they get darker. Edits the array in place.
 */
export function whiteToTransparent(rgba: Uint8ClampedArray | Uint8Array, threshold = 235): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const luminance = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    if (luminance >= threshold) rgba[i + 3] = 0;
    else rgba[i + 3] = Math.min(rgba[i + 3], Math.round(((threshold - luminance) / threshold) * 255 * 1.4));
  }
}
