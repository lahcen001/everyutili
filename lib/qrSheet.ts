export interface Paper {
  id: "a4" | "letter";
  label: string;
  /** millimetres */
  w: number;
  h: number;
}

export const PAPERS: Paper[] = [
  { id: "a4", label: "A4", w: 210, h: 297 },
  { id: "letter", label: "US Letter", w: 215.9, h: 279.4 },
];

export interface SheetLayout {
  paper: Paper;
  columns: number;
  /** page margin and gap between codes, in mm */
  margin: number;
  gap: number;
}

export interface SheetGeometry {
  cellW: number;
  cellH: number;
  rows: number;
  perPage: number;
}

/** How many codes fit on one page, given the aspect (height ÷ width) of one finished code with its title. */
export function sheetGeometry(layout: SheetLayout, aspect: number): SheetGeometry {
  const cols = Math.max(1, Math.floor(layout.columns));
  const cellW = (layout.paper.w - layout.margin * 2 - layout.gap * (cols - 1)) / cols;
  const cellH = cellW * aspect;
  const usableH = layout.paper.h - layout.margin * 2;
  const rows = Math.max(1, Math.floor((usableH + layout.gap) / (cellH + layout.gap)));
  return { cellW, cellH, rows, perPage: cols * rows };
}

export const pageCount = (total: number, perPage: number): number => (total === 0 ? 0 : Math.ceil(total / perPage));

/** A print-ready HTML document: one `.page` per sheet, codes laid out in a grid. */
export function sheetHtml(svgs: string[], layout: SheetLayout, aspect: number, guides: boolean): string {
  const g = sheetGeometry(layout, aspect);
  const pages: string[][] = [];
  for (let i = 0; i < svgs.length; i += g.perPage) pages.push(svgs.slice(i, i + g.perPage));
  const css = `
    @page { size: ${layout.paper.w}mm ${layout.paper.h}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page { width: ${layout.paper.w}mm; height: ${layout.paper.h}mm; padding: ${layout.margin}mm; display: grid; grid-template-columns: repeat(${Math.max(1, Math.floor(layout.columns))}, ${g.cellW}mm); grid-auto-rows: ${g.cellH}mm; gap: ${layout.gap}mm; align-content: start; justify-content: start; page-break-after: always; break-after: page; overflow: hidden; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .c { width: ${g.cellW}mm; height: ${g.cellH}mm; ${guides ? "outline: 0.2mm dashed #9ca3af; outline-offset: 0;" : ""} }
    .c svg { display: block; width: 100%; height: 100%; }
  `;
  const body = pages.map((p) => `<div class="page">${p.map((s) => `<div class="c">${s}</div>`).join("")}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>QR codes</title><style>${css}</style></head><body>${body}</body></html>`;
}

/** Parses "Title | content" lines (or just content) into rows. */
export function parseRows(text: string): { title: string; content: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("|");
      if (i === -1) return { title: "", content: line };
      return { title: line.slice(0, i).trim(), content: line.slice(i + 1).trim() };
    })
    .filter((r) => r.content);
}
