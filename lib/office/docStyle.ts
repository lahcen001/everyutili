import type { DocTheme } from "@/lib/office/docThemes";

export interface FontChoice {
  id: string;
  label: string;
  /** name written into Word files */
  font: string;
  cssFont: string;
}

export const FONT_CHOICES: FontChoice[] = [
  { id: "theme", label: "Style default", font: "", cssFont: "" },
  { id: "calibri", label: "Calibri", font: "Calibri", cssFont: "Calibri, Carlito, Arial, sans-serif" },
  { id: "arial", label: "Arial", font: "Arial", cssFont: "Arial, Helvetica, sans-serif" },
  { id: "verdana", label: "Verdana", font: "Verdana", cssFont: "Verdana, Geneva, sans-serif" },
  { id: "georgia", label: "Georgia", font: "Georgia", cssFont: "Georgia, 'Times New Roman', serif" },
  { id: "times", label: "Times New Roman", font: "Times New Roman", cssFont: "'Times New Roman', Times, serif" },
  { id: "cambria", label: "Cambria", font: "Cambria", cssFont: "Cambria, Caladea, Georgia, serif" },
  { id: "garamond", label: "Garamond", font: "Garamond", cssFont: "Garamond, 'EB Garamond', Georgia, serif" },
  { id: "courier", label: "Courier New", font: "Courier New", cssFont: "'Courier New', Courier, monospace" },
  { id: "system", label: "System UI", font: "Arial", cssFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
];

export interface StyleOverrides {
  fontId: string;
  /** hex without #, or null to keep the style's colour */
  accent: string | null;
  /** multiple of font size, or null to keep the style's spacing */
  lineHeight: number | null;
}

export const NO_OVERRIDES: StyleOverrides = { fontId: "theme", accent: null, lineHeight: null };

const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.padEnd(6, "0");
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
}

const toHex = (rgb: number[]) => rgb.map((v) => clamp(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Blend `hex` toward white (amount>0) or black (amount<0). */
export function shade(hex: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(parseHex(hex).map((v) => v + (target - v) * t));
}

/** A style with the user's font, accent colour and line spacing applied on top. */
export function applyOverrides(theme: DocTheme, o: StyleOverrides): DocTheme {
  const out: DocTheme = { ...theme };
  const font = FONT_CHOICES.find((f) => f.id === o.fontId);
  if (font && font.id !== "theme") {
    out.font = font.font;
    out.headingFont = font.font;
    out.cssFont = font.cssFont;
  }
  if (o.accent && /^[0-9a-fA-F]{6}$/.test(o.accent)) {
    const accent = o.accent.toUpperCase();
    out.accent = accent;
    out.link = accent;
    out.headingColor = shade(accent, -0.45);
    out.tableHeaderBg = shade(accent, 0.85);
    out.tableHeaderText = shade(accent, -0.5);
    out.tableBorder = shade(accent, 0.7);
  }
  if (o.lineHeight && o.lineHeight >= 1 && o.lineHeight <= 3) out.lineHeight = o.lineHeight;
  return out;
}
