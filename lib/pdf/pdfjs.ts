import type { PDFDocumentProxy } from "pdfjs-dist";

/** Opens PDF bytes with pdf.js (workers are set up once). Call `destroy()` when done. */
export async function openPdf(bytes: Uint8Array): Promise<{ pdf: PDFDocumentProxy; destroy: () => Promise<void> }> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjsLib.getDocument({ data: bytes.slice(0) });
  const pdf = await task.promise;
  return { pdf, destroy: () => task.destroy() };
}

/** Renders a page (1-based) to a canvas at the given scale. */
export async function renderPageCanvas(pdf: PDFDocumentProxy, pageNumber: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/png", quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality));
