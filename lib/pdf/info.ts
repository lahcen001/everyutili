import { PDFDocument, PDFName } from "pdf-lib";

export interface PdfInfo {
  title: string;
  author: string;
  subject: string;
  /** comma-separated */
  keywords: string;
  creator: string;
  producer: string;
  creationDate: Date | null;
  modificationDate: Date | null;
}

export interface PdfFacts {
  info: PdfInfo;
  pageCount: number;
  /** first page size in points, as displayed */
  pageSize: { width: number; height: number };
  hasXmp: boolean;
}

export const EMPTY_INFO: PdfInfo = { title: "", author: "", subject: "", keywords: "", creator: "", producer: "", creationDate: null, modificationDate: null };

export async function readPdfInfo(bytes: Uint8Array): Promise<PdfFacts> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const first = doc.getPageCount() > 0 ? doc.getPage(0) : null;
  const rotated = first ? first.getRotation().angle % 180 !== 0 : false;
  const size = first ? first.getSize() : { width: 0, height: 0 };
  return {
    info: {
      title: doc.getTitle() ?? "",
      author: doc.getAuthor() ?? "",
      subject: doc.getSubject() ?? "",
      keywords: doc.getKeywords() ?? "",
      creator: doc.getCreator() ?? "",
      producer: doc.getProducer() ?? "",
      creationDate: doc.getCreationDate() ?? null,
      modificationDate: doc.getModificationDate() ?? null,
    },
    pageCount: doc.getPageCount(),
    pageSize: rotated ? { width: size.height, height: size.width } : size,
    hasXmp: doc.catalog.has(PDFName.of("Metadata")),
  };
}

export interface ApplyOptions {
  /** also drop the XMP metadata stream, which can repeat the same fields (and more) */
  removeXmp: boolean;
  /** stamp the modification date with the current time */
  touchModified: boolean;
}

/** Writes the fields (blank ones are removed rather than saved as empty text). */
export async function applyPdfInfo(bytes: Uint8Array, info: PdfInfo, options: ApplyOptions = { removeXmp: true, touchModified: false }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const infoRef = doc.context.trailerInfo.Info;
  const dict = infoRef ? doc.context.lookup(infoRef) : undefined;
  if (dict && "keys" in (dict as object)) {
    const d = dict as unknown as { keys(): { asString(): string }[]; delete(name: ReturnType<typeof PDFName.of>): void };
    for (const key of d.keys()) d.delete(PDFName.of(key.asString().replace(/^\//, "")));
  }
  if (info.title.trim()) doc.setTitle(info.title.trim());
  if (info.author.trim()) doc.setAuthor(info.author.trim());
  if (info.subject.trim()) doc.setSubject(info.subject.trim());
  const keywords = info.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  if (keywords.length > 0) doc.setKeywords(keywords);
  if (info.creator.trim()) doc.setCreator(info.creator.trim());
  if (info.producer.trim()) doc.setProducer(info.producer.trim());
  if (info.creationDate) doc.setCreationDate(info.creationDate);
  if (info.modificationDate || options.touchModified) doc.setModificationDate(options.touchModified ? new Date() : (info.modificationDate as Date));
  if (options.removeXmp) doc.catalog.delete(PDFName.of("Metadata"));
  return doc.save();
}

/** `<input type="datetime-local">` value for a date, in local time. */
export function toLocalInput(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PAPERS: { name: string; w: number; h: number }[] = [
  { name: "A3", w: 841.89, h: 1190.55 },
  { name: "A4", w: 595.28, h: 841.89 },
  { name: "A5", w: 419.53, h: 595.28 },
  { name: "Letter", w: 612, h: 792 },
  { name: "Legal", w: 612, h: 1008 },
  { name: "Tabloid", w: 792, h: 1224 },
];

/** "A4 (portrait)" for a page size in points, or null when it isn't a standard paper (within 2 pt). */
export function paperName(width: number, height: number): string | null {
  const [short, long] = width <= height ? [width, height] : [height, width];
  const hit = PAPERS.find((p) => Math.abs(p.w - short) <= 2 && Math.abs(p.h - long) <= 2);
  if (!hit) return null;
  return `${hit.name} (${width <= height ? "portrait" : "landscape"})`;
}

export const pointsToMm = (pt: number) => (pt * 25.4) / 72;
