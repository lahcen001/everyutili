import type { Block, Inline, ListItem } from "@/lib/office/docModel";
import type { PdfTextItem } from "@/lib/pdf/text";

export interface PdfLine {
  text: string;
  /** left edge and baseline, in PDF points */
  x: number;
  y: number;
  /** font size in points */
  size: number;
}

const sizeOf = (item: PdfTextItem) => Math.abs(item.transform[3]) || item.height || 10;

/** Groups pdf.js text items into lines (top to bottom) and keeps each line's position and font size. */
export function itemsToPdfLines(items: PdfTextItem[]): PdfLine[] {
  const usable = items.filter((item) => item.str !== "" && item.transform.length >= 6);
  if (usable.length === 0) return [];
  const sorted = [...usable].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);

  const groups: PdfTextItem[][] = [];
  for (const item of sorted) {
    const current = groups[groups.length - 1];
    if (current && Math.abs(item.transform[5] - current[0].transform[5]) <= sizeOf(item) * 0.4) current.push(item);
    else groups.push([item]);
  }

  const lines: PdfLine[] = [];
  for (const group of groups) {
    const ordered = [...group].sort((a, b) => a.transform[4] - b.transform[4]);
    let text = "";
    let previousEnd: number | null = null;
    let size = 0;
    for (const item of ordered) {
      const s = sizeOf(item);
      if (item.str.trim() !== "") size = Math.max(size, s);
      if (previousEnd !== null && text !== "" && !text.endsWith(" ") && !item.str.startsWith(" ") && item.transform[4] - previousEnd > s * 0.15) text += " ";
      text += item.str;
      previousEnd = item.transform[4] + item.width;
    }
    text = text.replace(/\s+$/g, "");
    if (text.trim() !== "") lines.push({ text, x: ordered[0].transform[4], y: ordered[0].transform[5], size: size || sizeOf(ordered[0]) });
  }
  return lines;
}

/** The most common font size, weighted by how much text uses it — that is the body text. */
export function bodyFontSize(pages: PdfLine[][]): number {
  const weight = new Map<number, number>();
  for (const page of pages) for (const l of page) weight.set(Math.round(l.size * 2) / 2, (weight.get(Math.round(l.size * 2) / 2) ?? 0) + l.text.length);
  let best = 11;
  let bestWeight = 0;
  for (const [size, w] of weight) if (w > bestWeight) (best = size), (bestWeight = w);
  return best;
}

const normalizeForRepeat = (t: string) => t.trim().replace(/\d+/g, "#").toLowerCase();

/**
 * Removes running headers/footers and bare page numbers: text that appears at the top or bottom of most
 * pages (digits ignored) — only attempted for documents of three pages or more.
 */
export function stripRunningText(pages: PdfLine[][]): PdfLine[][] {
  if (pages.length < 3) return pages;
  const counts = new Map<string, number>();
  // one line at each end of a short page, two on a full page, so body text is never mistaken for a header
  const edge = (page: PdfLine[]) => {
    const n = page.length >= 8 ? 2 : 1;
    return [...page.slice(0, n), ...page.slice(-n)];
  };
  for (const page of pages) for (const key of new Set(edge(page).map((l) => normalizeForRepeat(l.text)))) counts.set(key, (counts.get(key) ?? 0) + 1);
  const threshold = Math.ceil(pages.length * 0.6);
  return pages.map((page) => {
    const edges = new Set(edge(page));
    return page.filter((l) => !(edges.has(l) && (counts.get(normalizeForRepeat(l.text)) ?? 0) >= threshold) && !(edges.has(l) && /^\s*(page\s+)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?\s*$/i.test(l.text)));
  });
}

const BULLET = /^([•◦▪●■□○‣·\-–—*])\s+(.*)$/;
const NUMBERED = /^(\d{1,3}|[A-Za-z])[.)]\s+(.*)$/;
const SENTENCE_END = /[.!?:;)"”»]$/;

const run = (text: string): Inline[] => [{ text }];

function mend(current: string, next: string): string {
  if (/[a-z]-$/.test(current) && /^[a-z]/.test(next)) return current.slice(0, -1) + next;
  return `${current} ${next}`;
}

export interface ConvertOptions {
  removeRunningText: boolean;
}

/** Turns lines of text into headings, lists and paragraphs, using font size, indentation and spacing. */
export function linesToBlocks(pages: PdfLine[][], options: ConvertOptions = { removeRunningText: true }): Block[] {
  const source = options.removeRunningText ? stripRunningText(pages) : pages;
  const body = bodyFontSize(source);
  const blocks: Block[] = [];
  let para: { text: string; size: number; y: number; x: number } | null = null;
  let leftMargin = Infinity;
  for (const page of source) for (const l of page) if (Math.abs(l.size - body) < 0.6) leftMargin = Math.min(leftMargin, l.x);
  if (!Number.isFinite(leftMargin)) leftMargin = 0;

  const flush = () => {
    if (para) blocks.push({ type: "paragraph", runs: run(para.text) });
    para = null;
  };

  let lastHeading: { index: number; size: number; y: number } | null = null;
  let lastList: { ordered: boolean; items: ListItem[]; x: number; y: number } | null = null;

  for (let pi = 0; pi < source.length; pi++) {
    const page = source[pi];
    for (let li = 0; li < page.length; li++) {
      const line = page[li];
      const text = line.text.trim();
      const prevY: number | null = li > 0 ? page[li - 1].y : null;
      const gap = prevY === null ? Infinity : prevY - line.y;

      // heading: clearly bigger than the body text and short
      if (line.size >= body * 1.15 && text.length <= 140) {
        flush();
        lastList = null;
        const last = lastHeading && blocks[lastHeading.index];
        if (lastHeading && last && last.type === "heading" && Math.abs(lastHeading.size - line.size) < 0.6 && lastHeading.y - line.y <= line.size * 1.8) {
          last.runs = run(`${last.runs.map((r) => r.text).join("")} ${text}`);
          lastHeading.y = line.y;
        } else {
          const ratio = line.size / body;
          blocks.push({ type: "heading", level: ratio >= 1.7 ? 1 : ratio >= 1.35 ? 2 : 3, runs: run(text) });
          lastHeading = { index: blocks.length - 1, size: line.size, y: line.y };
        }
        continue;
      }
      lastHeading = null;

      const bullet = BULLET.exec(text);
      const numbered = !bullet ? NUMBERED.exec(text) : null;
      if (bullet || numbered) {
        flush();
        const ordered = !bullet;
        const item: ListItem = { runs: run((bullet ?? numbered)![2]), level: 0 };
        if (lastList && lastList.ordered === ordered && lastList.y - line.y <= line.size * 2.6) {
          lastList.items.push(item);
        } else {
          const block: Block = { type: "list", ordered, items: [item] };
          blocks.push(block);
          lastList = { ordered, items: block.items, x: line.x, y: line.y };
        }
        lastList.y = line.y;
        continue;
      }

      // a wrapped line belonging to the previous list item
      if (lastList && line.x > lastList.x + 2 && lastList.y - line.y <= line.size * 1.7) {
        const lastItem = lastList.items[lastList.items.length - 1];
        lastItem.runs = run(mend(lastItem.runs.map((r) => r.text).join(""), text));
        lastList.y = line.y;
        continue;
      }
      lastList = null;

      const sameBlock =
        para !== null &&
        Math.abs(para.size - line.size) < 0.6 &&
        (li > 0 ? gap <= line.size * 1.7 : !SENTENCE_END.test(para.text)) &&
        !(line.x > leftMargin + line.size * 1.2 && SENTENCE_END.test(para.text));
      if (sameBlock && para) {
        para.text = mend(para.text, text);
        para.y = line.y;
      } else {
        flush();
        para = { text, size: line.size, y: line.y, x: line.x };
      }
    }
  }
  flush();
  return blocks;
}

/** True when the PDF has almost no text layer (probably a scan). */
export function looksScanned(pages: PdfLine[][]): boolean {
  return pages.reduce((n, p) => n + p.reduce((m, l) => m + l.text.length, 0), 0) < 20 * Math.max(1, pages.length) * 0.5;
}
