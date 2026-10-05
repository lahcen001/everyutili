import { PDFDocument } from "pdf-lib";

export type CompressMode = "lossless" | "balanced" | "strong";

/** Raster modes re-render every page as a JPEG: smaller files, but text is no longer selectable. */
export const RASTER_PRESETS = {
  balanced: { dpi: 150, quality: 0.72 },
  strong: { dpi: 100, quality: 0.5 },
} as const;

/** Percent smaller than the original; negative when the result is larger. */
export function savedPercent(originalSize: number, resultSize: number): number {
  if (originalSize <= 0) return 0;
  return Math.round((1 - resultSize / originalSize) * 100);
}

async function losslessCompress(bytes: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  pdf.setTitle("");
  pdf.setAuthor("");
  pdf.setSubject("");
  pdf.setKeywords([]);
  pdf.setProducer("");
  pdf.setCreator("");
  return pdf.save({ useObjectStreams: true });
}

async function rasterCompress(
  bytes: ArrayBuffer,
  preset: { dpi: number; quality: number },
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const task = pdfjsLib.getDocument({ data: bytes.slice(0) });
  const source = await task.promise;
  const out = await PDFDocument.create();
  const scale = preset.dpi / 72;

  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber++) {
      const page = await source.getPage(pageNumber);
      const pointSize = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not acquire canvas context");
      // JPEG has no alpha: without a white fill, unpainted page areas would encode as black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode page"))), "image/jpeg", preset.quality)
      );
      const image = await out.embedJpg(await blob.arrayBuffer());
      const outPage = out.addPage([pointSize.width, pointSize.height]);
      outPage.drawImage(image, { x: 0, y: 0, width: pointSize.width, height: pointSize.height });

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
      onProgress?.(pageNumber, source.numPages);
    }
  } finally {
    await task.destroy();
  }

  return out.save({ useObjectStreams: true });
}

export async function compressPdfBytes(
  bytes: ArrayBuffer,
  mode: CompressMode,
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  if (mode === "lossless") return losslessCompress(bytes);
  return rasterCompress(bytes, RASTER_PRESETS[mode], onProgress);
}
