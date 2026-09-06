/**
 * The subset of media tools that both (a) accept a file as input via
 * DropZone and (b) produce a downloadable result blob — i.e. every tool
 * that can meaningfully be a "Send to..." destination for another tool's
 * output. Hand-curated (like config/tools.ts's relatedSlugs) rather than
 * derived from the registry, since "accepts a file" isn't tracked metadata
 * there and most tools (calculators, text utilities) don't apply at all.
 *
 * Split by accepted media type so an image result is only ever offered
 * image-consuming destinations, and a video result only video ones —
 * sending a video into e.g. Image Cropper would just fail silently.
 */
export const IMAGE_PIPELINE_SLUGS = [
  "image-compressor",
  "image-resizer",
  "image-cropper",
  "image-annotator",
  "image-filters",
  "image-collage",
  "watermark-maker",
  "favicon-generator",
  "exif-stripper",
  "base64-image-encoder",
  "color-picker",
  "svg-optimizer",
  "jpg-to-png",
  "png-to-jpg",
  "heic-to-jpg",
  "webp-converter",
  "svg-to-png",
  "svg-to-jpg",
  "svg-to-webp",
  "png-to-webp",
  "webp-to-png",
  "webp-to-jpg",
  "jpg-to-webp",
] as const;

export const VIDEO_PIPELINE_SLUGS = [
  "video-trimmer",
  "video-to-gif",
  "video-speed",
  "video-audio-remover",
] as const;

export type PipelineMediaType = "image" | "video";

export function pipelineSlugsFor(mediaType: PipelineMediaType): readonly string[] {
  return mediaType === "image" ? IMAGE_PIPELINE_SLUGS : VIDEO_PIPELINE_SLUGS;
}

/** Infers pipeline media type from a result blob's MIME type, or null if neither applies. */
export function mediaTypeForBlob(blob: Blob): PipelineMediaType | null {
  if (blob.type.startsWith("image/")) return "image";
  if (blob.type.startsWith("video/")) return "video";
  return null;
}
