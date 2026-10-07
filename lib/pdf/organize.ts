import { PDFDocument, degrees } from "pdf-lib";
import { normalizeAngle } from "@/lib/pdf/rotation";

/** One page in the new document: a page copied from one of the loaded PDFs, or a blank page. */
export type PageItem =
  | { id: string; kind: "page"; source: number; /** 0-based page index in that PDF */ page: number; /** extra clockwise rotation: 0, 90, 180, 270 */ rotation: number }
  | { id: string; kind: "blank"; width: number; height: number };

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

export function removeItems(items: PageItem[], ids: Set<string>): PageItem[] {
  return items.filter((i) => !ids.has(i.id));
}

/** A copy of the page right after the original. */
export function duplicateItem(items: PageItem[], index: number, newId: string): PageItem[] {
  const item = items[index];
  if (!item) return items;
  const next = [...items];
  next.splice(index + 1, 0, { ...item, id: newId });
  return next;
}

/** A blank page after `index`, the same size as that page (or A4 if unknown). */
export function insertBlankAfter(items: PageItem[], index: number, newId: string, size: { width: number; height: number } = { width: 595.28, height: 841.89 }): PageItem[] {
  const next = [...items];
  next.splice(index + 1, 0, { id: newId, kind: "blank", width: size.width, height: size.height });
  return next;
}

export function rotateItems(items: PageItem[], ids: Set<string>, delta: number): PageItem[] {
  return items.map((i) => (i.kind === "page" && ids.has(i.id) ? { ...i, rotation: normalizeAngle(i.rotation + delta) } : i));
}

export function reverseItems<T>(items: T[]): T[] {
  return [...items].reverse();
}

/** Pages in the order 1,3,5… then 2,4,6… — useful after scanning both sides of a stack separately. */
export function oddThenEven<T>(items: T[]): T[] {
  return [...items.filter((_, i) => i % 2 === 0), ...items.filter((_, i) => i % 2 === 1)];
}

/**
 * Interleaves a front-side scan (1,2,3…) with a back-side scan that was fed in reverse (…3,2,1):
 * the result is front1, back1, front2, back2…
 */
export function interleaveDuplex<T>(items: T[]): T[] {
  const half = Math.ceil(items.length / 2);
  const fronts = items.slice(0, half);
  const backs = items.slice(half).reverse();
  const out: T[] = [];
  fronts.forEach((f, i) => {
    out.push(f);
    if (backs[i] !== undefined) out.push(backs[i]);
  });
  return out;
}

/** Builds the new PDF from the loaded source documents and the ordered page list. */
export async function buildOrganizedPdf(sources: Uint8Array[], items: PageItem[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const loaded = new Map<number, PDFDocument>();
  for (const item of items) {
    if (item.kind === "blank") {
      out.addPage([item.width, item.height]);
      continue;
    }
    let doc = loaded.get(item.source);
    if (!doc) {
      doc = await PDFDocument.load(sources[item.source], { updateMetadata: false });
      loaded.set(item.source, doc);
    }
    const [copy] = await out.copyPages(doc, [item.page]);
    if (item.rotation) copy.setRotation(degrees(normalizeAngle(copy.getRotation().angle + item.rotation)));
    out.addPage(copy);
  }
  return out.save();
}
