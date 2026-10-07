import type { DocTheme } from "@/lib/office/docThemes";
import { mmToPx, pageDimensionsMm, type PageSettings } from "@/lib/office/pageSettings";

export interface CoverOptions {
  enabled: boolean;
  title: string;
  subtitle: string;
  author: string;
  date: string;
}

export interface TocOptions {
  enabled: boolean;
  /** deepest heading level listed (1–3) */
  maxLevel: 1 | 2 | 3;
  title: string;
}

export interface TocEntry {
  id: string;
  level: number;
  text: string;
}

export const DEFAULT_COVER: CoverOptions = { enabled: false, title: "", subtitle: "", author: "", date: "" };
export const DEFAULT_TOC: TocOptions = { enabled: false, maxLevel: 2, title: "Contents" };

/** Height of the printable area of one page, in CSS px. */
export function pageContentHeightPx(page: PageSettings): number {
  const { height } = pageDimensionsMm(page);
  return Math.round(mmToPx(height - page.marginMm * 2));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Gives h1–h(maxLevel) an id and lists them. Needs a DOM (browser, or jsdom in tests). */
export function addHeadingIds(html: string, maxLevel: number): { html: string; entries: TocEntry[] } {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const entries: TocEntry[] = [];
  doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    const level = Number(h.tagName.slice(1));
    if (level > maxLevel) return;
    const text = (h.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const id = `toc-${entries.length}`;
    h.setAttribute("id", id);
    entries.push({ id, level, text });
  });
  return { html: doc.body.innerHTML, entries };
}

/** The contents list. `pages` are the page numbers to print (same length as entries); use "00" while measuring. */
export function tocHtml(entries: TocEntry[], pages: (number | string)[], title: string): string {
  if (entries.length === 0) return "";
  const minLevel = Math.min(...entries.map((e) => e.level));
  const rows = entries
    .map((e, i) => {
      const indent = (e.level - minLevel) * 14;
      const bold = e.level === minLevel ? "font-weight:600;" : "";
      return `<div class="doc-toc-row" style="display:flex;align-items:baseline;gap:6px;margin:0 0 4pt;padding-left:${indent}pt;${bold}"><span>${esc(e.text)}</span><span style="flex:1;border-bottom:1px dotted #9ca3af;transform:translateY(-3px)"></span><span style="font-variant-numeric:tabular-nums">${esc(String(pages[i] ?? ""))}</span></div>`;
    })
    .join("");
  return `<nav class="doc-toc"><p style="font-size:1.7em;font-weight:700;margin:0 0 12pt">${esc(title)}</p>${rows}</nav><div data-page-break style="height:0"></div>`;
}

/** A title page that fills exactly one page. */
export function coverHtml(c: CoverOptions, heightPx: number, theme: Pick<DocTheme, "accent" | "headingColor">): string {
  if (!c.enabled) return "";
  const parts = [
    `<div style="width:64px;height:6px;background:#${theme.accent};margin:0 auto 28px"></div>`,
    `<p style="font-size:2.8em;font-weight:800;line-height:1.15;margin:0 0 14px;color:#${theme.headingColor}">${esc(c.title || "Untitled")}</p>`,
    c.subtitle ? `<p style="font-size:1.35em;margin:0 0 40px;color:#6b7280">${esc(c.subtitle)}</p>` : "",
    c.author ? `<p style="font-size:1.1em;font-weight:600;margin:0 0 4px">${esc(c.author)}</p>` : "",
    c.date ? `<p style="font-size:1em;margin:0;color:#6b7280">${esc(c.date)}</p>` : "",
  ];
  return `<section data-page-break style="box-sizing:border-box;height:${Math.max(200, heightPx - 2)}px;display:flex;flex-direction:column;justify-content:center;text-align:center;padding:0 8%;overflow:hidden">${parts.join("")}</section>`;
}

/** Page index (0-based) holding `top`, given the page slices. */
export function pageIndexAt(slices: { start: number; end: number }[], top: number): number {
  const i = slices.findIndex((s) => top >= s.start && top < s.end);
  return i === -1 ? Math.max(0, slices.length - 1) : i;
}

/** The printed page number for a 0-based slice index, when the first `coverPages` pages are unnumbered. */
export const printedPage = (sliceIndex: number, coverPages: number) => sliceIndex - coverPages + 1;
