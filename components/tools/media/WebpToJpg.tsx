"use client";

import ImageConvertTool from "@/components/tools/media/ImageConvertTool";

export default function WebpToJpg() {
  return (
    <ImageConvertTool
      slug="webp-to-jpg"
      output="jpeg"
      accept="image/webp"
      matches={(f) => f.type === "image/webp"}
      defaultQuality={0.9}
      dropLabel="Drag & drop WebP images here, or click to browse"
      dropHint="Batch convert to JPG — transparent areas get the background colour you pick (white by default)"
    />
  );
}
