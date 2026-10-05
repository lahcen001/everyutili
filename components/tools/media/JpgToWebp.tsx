"use client";

import ImageConvertTool from "@/components/tools/media/ImageConvertTool";

export default function JpgToWebp() {
  return (
    <ImageConvertTool
      slug="jpg-to-webp"
      output="webp"
      accept="image/jpeg"
      matches={(f) => f.type === "image/jpeg"}
      defaultQuality={0.85}
      dropLabel="Drag & drop JPG images here, or click to browse"
      dropHint="Batch convert to WebP — smaller files, same quality"
    />
  );
}
