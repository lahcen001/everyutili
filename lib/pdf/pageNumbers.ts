import { visualToUser } from "@/lib/pdf/rotation";

export type LabelPosition =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right";

export type NumeralStyle = "arabic" | "roman-upper" | "roman-lower";

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [value, symbol] of table) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export function formatNumeral(n: number, style: NumeralStyle): string {
  if (style === "roman-upper") return toRoman(n);
  if (style === "roman-lower") return toRoman(n).toLowerCase();
  return String(n);
}

export function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(full, 16);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export interface Placement {
  x: number;
  y: number;
  /** Degrees counter-clockwise in PDF user space; cancels the page's /Rotate so text reads upright. */
  rotation: number;
}

/**
 * Where to draw a label so it appears at `position` on the page *as displayed*. Pages with a
 * /Rotate of 90/180/270 have their content rotated on screen, so "bottom" in user space isn't the
 * visual bottom. Coordinates are PDF points, `width`/`height` are the unrotated page size.
 */
export function placeLabel(opts: {
  width: number;
  height: number;
  pageRotation: number;
  textWidth: number;
  position: LabelPosition;
  margin: number;
}): Placement {
  const { width: W, height: H, textWidth, position, margin } = opts;
  const rotation = ((Math.round(opts.pageRotation / 90) * 90) % 360 + 360) % 360;
  const sideways = rotation === 90 || rotation === 270;
  const vw = sideways ? H : W;
  const vh = sideways ? W : H;

  let sx = margin;
  if (position.endsWith("center")) sx = (vw - textWidth) / 2;
  if (position.endsWith("right")) sx = vw - textWidth - margin;
  const sy = position.startsWith("top") ? vh - margin : margin;

  const user = visualToUser(sx, sy, W, H, rotation);
  return { x: user.x, y: user.y, rotation };
}
