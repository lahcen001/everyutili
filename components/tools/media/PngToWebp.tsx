"use client";

import ImageConvertTool from "@/components/tools/media/ImageConvertTool";

export default function PngToWebp() {
  return (
    <ImageConvertTool
      slug="png-to-webp"
      output="webp"
      accept="image/png"
      matches={(f) => f.type === "image/png"}
      defaultQuality={0.85}
      dropLabel="Drag & drop PNG images here, or click to browse"
      dropHint="Batch convert to WebP — smaller files, transparency preserved"
    />
  );
}
