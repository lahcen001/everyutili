import type { ImageOutputFormat } from "@/workers/image-converter.worker";

const MIME: Record<ImageOutputFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const EXT: Record<ImageOutputFormat, string> = { png: "png", jpeg: "jpg", webp: "webp" };

/** Make sure the SVG declares a pixel size, otherwise some browsers decode it at 0×0 or 150×150. */
export function withExplicitSize(svgText: string, width: number, height: number): string {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) throw new Error("This file isn't a valid SVG.");
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!svg.getAttribute("viewBox")) {
    const w = parseFloat(svg.getAttribute("width") ?? "");
    const h = parseFloat(svg.getAttribute("height") ?? "");
    if (w > 0 && h > 0) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Rasterize an SVG on the main thread. Browsers decode SVG reliably through an <img> element,
 * whereas createImageBitmap on an SVG Blob (what a worker would use) is not supported everywhere.
 */
export async function rasterizeSvg(file: File, width: number, height: number, format: ImageOutputFormat, quality: number, background: string): Promise<{ blob: Blob; fileName: string }> {
  const text = withExplicitSize(await file.text(), width, height);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The browser couldn't render this SVG."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire canvas context");
    if (format === "jpeg") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), MIME[format], format === "png" ? undefined : quality)
    );
    return { blob, fileName: `${file.name.replace(/\.[^/.]+$/, "")}.${EXT[format]}` };
  } finally {
    URL.revokeObjectURL(url);
  }
}
