"use client";

import ImageConvertTool from "@/components/tools/media/ImageConvertTool";

export default function WebpToPng() {
  return (
    <ImageConvertTool
      slug="webp-to-png"
      output="png"
      accept="image/webp"
      matches={(f) => f.type === "image/webp"}
      defaultQuality={1}
      dropLabel="Drag & drop WebP images here, or click to browse"
      dropHint="Batch convert to PNG — universal compatibility, transparency preserved"
    />
  );
}
