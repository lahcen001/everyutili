/** A concrete, user-selectable output format (used by tools with a format picker, e.g. ImageConverter). */
export type ImageOutputFormat = "png" | "jpeg" | "webp";

/** format the worker accepts: a concrete ImageOutputFormat, or "auto" to keep the source file's own format. */
export type ImageConvertFormat = ImageOutputFormat | "auto";

export interface ImageConvertRequest {
  id: string;
  file: File;
  /** "auto" keeps the source file's own format (e.g. for compression, where changing format is unwanted). */
  format: ImageConvertFormat;
  quality: number;
  /** Proportional downscale: only applies when the image is wider than this. Ignored if exactWidth/exactHeight are set. */
  maxWidth: number | null;
  /** Exact output dimensions (e.g. for the resizer, which lets the user set width/height directly). Takes priority over maxWidth. */
  exactWidth?: number;
  exactHeight?: number;
}

export interface ImageConvertSuccess {
  id: string;
  status: "success";
  blob: Blob;
  fileName: string;
}

export interface ImageConvertError {
  id: string;
  status: "error";
  message: string;
}

export type ImageConvertResponse = ImageConvertSuccess | ImageConvertError;

const MIME_BY_FORMAT: Record<ImageOutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

self.onmessage = async (event: MessageEvent<ImageConvertRequest>) => {
  const { id, file, format, quality, maxWidth, exactWidth, exactHeight } = event.data;

  try {
    // For an exact target size (the resizer, and SVG rasterization where the
    // source has no fixed pixel dimensions), decode directly at that
    // resolution via createImageBitmap's own resize options rather than
    // decoding at the source's default size and scaling afterward — for a
    // vector source (SVG) this re-rasterizes crisply at the target size
    // instead of upscaling a blurry small bitmap.
    const bitmap =
      exactWidth && exactHeight
        ? await createImageBitmap(file, {
            resizeWidth: exactWidth,
            resizeHeight: exactHeight,
            resizeQuality: "high",
          })
        : await createImageBitmap(file);

    let { width, height } = bitmap;
    if (exactWidth && exactHeight) {
      width = exactWidth;
      height = exactHeight;
    } else if (maxWidth && width > maxWidth) {
      const ratio = maxWidth / width;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire canvas context");

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputMime = format === "auto" ? file.type || "image/png" : MIME_BY_FORMAT[format];
    const blob = await canvas.convertToBlob({
      type: outputMime,
      quality: outputMime === "image/png" ? undefined : quality,
    });

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const extension = EXTENSION_BY_MIME[outputMime] ?? "png";
    const fileName = `${baseName}.${extension}`;

    const response: ImageConvertResponse = { id, status: "success", blob, fileName };
    (self as unknown as Worker).postMessage(response);
  } catch (error) {
    const response: ImageConvertResponse = {
      id,
      status: "error",
      message: error instanceof Error ? error.message : "Unknown conversion error",
    };
    (self as unknown as Worker).postMessage(response);
  }
};

export {};
