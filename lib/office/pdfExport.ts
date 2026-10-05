import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import { themeCss, type DocTheme } from "@/lib/office/docThemes";
import { paginate, type PageSlice } from "@/lib/office/paginate";
import { mmToPx, pageDimensionsMm, type PageSettings } from "@/lib/office/pageSettings";

export const DOC_SCOPE = "doc-root";
const PX_PER_MM = 96 / 25.4;

export interface PdfLayout {
  /** Width of the printable area in CSS px. */
  widthPx: number;
  /** Height of the printable area of one page in CSS px. */
  heightPx: number;
  slices: PageSlice[];
}

function createHost(html: string, theme: DocTheme, widthPx: number, fontSizePt?: number): HTMLDivElement {
  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:-99999px;top:0;width:${widthPx}px;background:#ffffff;`;
  host.innerHTML = `<style>${themeCss(theme, DOC_SCOPE, fontSizePt)}</style><div class="${DOC_SCOPE}">${html}</div>`;
  document.body.appendChild(host);
  return host;
}

async function imagesLoaded(host: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(host.querySelectorAll("img")).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined)))
  );
}

/** Bottom edges (px, relative to the document top) where a page may end: blocks, table rows, list items — never headings. */
function measureBreakPoints(host: HTMLElement): { total: number; breaks: number[] } {
  const doc = host.querySelector(`.${DOC_SCOPE}`) as HTMLElement;
  const top = doc.getBoundingClientRect().top;
  const breaks: number[] = [];
  const add = (el: Element) => breaks.push(el.getBoundingClientRect().bottom - top);

  for (const child of Array.from(doc.children)) {
    const tag = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) continue;
    if (tag === "table") child.querySelectorAll("tr").forEach(add);
    else if (tag === "ul" || tag === "ol") child.querySelectorAll("li").forEach(add);
    else add(child);
  }
  return { total: doc.getBoundingClientRect().height, breaks };
}

/** Lays the document out at the page's printable width and decides where each page starts and ends. */
export async function layoutDocument(html: string, theme: DocTheme, page: PageSettings, fontSizePt?: number): Promise<PdfLayout> {
  const { width, height } = pageDimensionsMm(page);
  const widthPx = Math.round(mmToPx(width - page.marginMm * 2));
  const heightPx = Math.round(mmToPx(height - page.marginMm * 2));
  const host = createHost(html, theme, widthPx, fontSizePt);
  try {
    await imagesLoaded(host);
    const { total, breaks } = measureBreakPoints(host);
    return { widthPx, heightPx, slices: paginate(total, heightPx, breaks) };
  } finally {
    host.remove();
  }
}

async function renderSlice(html: string, theme: DocTheme, widthPx: number, slice: PageSlice, scale: number, fontSizePt?: number): Promise<HTMLCanvasElement> {
  const height = Math.max(1, Math.ceil(slice.end - slice.start));
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:fixed;left:-99999px;top:0;width:${widthPx}px;height:${height}px;overflow:hidden;background:#ffffff;`;
  const inner = document.createElement("div");
  inner.style.cssText = `position:absolute;left:0;top:${-slice.start}px;width:${widthPx}px;`;
  inner.innerHTML = `<style>${themeCss(theme, DOC_SCOPE, fontSizePt)}</style><div class="${DOC_SCOPE}">${html}</div>`;
  wrapper.appendChild(inner);
  document.body.appendChild(wrapper);
  try {
    await imagesLoaded(wrapper);
    return await html2canvas(wrapper, { backgroundColor: "#ffffff", scale, width: widthPx, height, windowWidth: widthPx });
  } finally {
    wrapper.remove();
  }
}

/** Header/footer text rendered through the browser so any script (Arabic, CJK…) works, then placed as an image. */
async function renderStrip(text: string, widthPx: number, align: "left" | "center", theme: DocTheme): Promise<string> {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;left:-99999px;top:0;width:${widthPx}px;padding:2px 0;background:#ffffff;color:#6b7280;font:9pt ${theme.cssFont};text-align:${align};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
  el.textContent = text;
  document.body.appendChild(el);
  try {
    const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2, width: widthPx });
    return canvas.toDataURL("image/png");
  } finally {
    el.remove();
  }
}

export interface PdfExportOptions {
  onProgress?: (done: number, total: number) => void;
  /** Rendering resolution multiplier (2 ≈ 190 dpi). */
  scale?: number;
  /** Body font size override in points (headings scale with it). */
  fontSizePt?: number;
}

/**
 * Builds a PDF from document HTML: paginates at safe break points, rasterizes each page and assembles
 * them with jsPDF. Text in the result is part of the page image (not selectable); use `printDocument`
 * for selectable text.
 */
export async function htmlToPdfBlob(html: string, theme: DocTheme, page: PageSettings, options: PdfExportOptions = {}): Promise<Blob> {
  const layout = await layoutDocument(html, theme, page, options.fontSizePt);
  const { width, height } = pageDimensionsMm(page);
  const contentWidthMm = width - page.marginMm * 2;
  const pdf = new jsPDF({ orientation: page.orientation === "landscape" ? "l" : "p", unit: "mm", format: page.size });
  const total = layout.slices.length;
  const stripWidthPx = layout.widthPx;
  const stripHeightMm = 6;
  const margin = page.marginMm;

  for (let i = 0; i < total; i++) {
    if (i > 0) pdf.addPage();
    const slice = layout.slices[i];
    const canvas = await renderSlice(html, theme, layout.widthPx, slice, options.scale ?? 2, options.fontSizePt);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, contentWidthMm, (slice.end - slice.start) / PX_PER_MM);
    canvas.width = 0;
    canvas.height = 0;

    if (page.headerText.trim()) {
      const strip = await renderStrip(page.headerText.trim(), stripWidthPx, "left", theme);
      pdf.addImage(strip, "PNG", margin, Math.max(2, margin / 2 - 3), contentWidthMm, stripHeightMm);
    }
    const footer = [page.footerText.trim(), page.pageNumbers ? String(i + 1) : ""].filter(Boolean).join("   ·   ");
    if (footer) {
      const strip = await renderStrip(footer, stripWidthPx, "center", theme);
      pdf.addImage(strip, "PNG", margin, height - Math.max(2, margin / 2 - 3) - stripHeightMm, contentWidthMm, stripHeightMm);
    }
    options.onProgress?.(i + 1, total);
  }
  return pdf.output("blob");
}

const CSS_PAPER: Record<PageSettings["size"], string> = { a4: "A4", letter: "letter", legal: "legal", a5: "A5" };

/** Opens the browser's print dialog for the document, where "Save as PDF" produces selectable, searchable text. */
export function printDocument(html: string, theme: DocTheme, page: PageSettings, fontSizePt?: number): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error("Could not open the print view.");
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Document</title><style>@page{size:${CSS_PAPER[page.size]} ${page.orientation};margin:${page.marginMm}mm}body{margin:0;background:#fff}${themeCss(theme, DOC_SCOPE, fontSizePt)}h1,h2,h3,h4,h5,h6{break-after:avoid}tr,li,pre,blockquote,img{break-inside:avoid}</style></head><body><div class="${DOC_SCOPE}">${html}</div></body></html>`
  );
  doc.close();
  const cleanup = () => window.setTimeout(() => iframe.remove(), 500);
  iframe.contentWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 300);
  window.setTimeout(() => iframe.remove(), 120000);
}
