/**
 * Renders one PDF page to an image and returns it as an object URL.
 *
 * pdfjs-dist already parses/decodes the PDF in its own dedicated worker
 * (see GlobalWorkerOptions.workerSrc, set by each caller); the one piece
 * that can't move off the main thread is `page.render()` itself, since its
 * public API requires a real CanvasRenderingContext2D tied to a live
 * canvas, not an OffscreenCanvas one. What we *can* fix on top of that:
 * canvas.toDataURL() is synchronous (blocks the main thread for the full
 * encode) and produces a base64 string (~33% larger than the binary it
 * encodes) that then sits in React state per thumbnail. canvas.toBlob() is
 * async (doesn't block) and yields the same bytes as a binary Blob — turned
 * into a short object URL instead, matching the pattern already used by
 * workers/image-converter.worker.ts.
 *
 * Callers own the returned URL's lifetime and must URL.revokeObjectURL it
 * when replaced/removed/unmounted.
 */
export async function renderPageToUrl(
  pdf: import("pdfjs-dist").PDFDocumentProxy,
  pageNumber: number,
  scale: number
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode page"))), "image/png");
  });
  return URL.createObjectURL(blob);
}
