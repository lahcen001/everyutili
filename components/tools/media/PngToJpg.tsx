"use client";

import ImageConvertTool from "@/components/tools/media/ImageConvertTool";

export default function PngToJpg() {
  return (
    <ImageConvertTool
      slug="png-to-jpg"
      output="jpeg"
      accept="image/png"
      matches={(f) => f.type === "image/png"}
      defaultQuality={0.9}
      dropLabel="Drag & drop PNG images here, or click to browse"
      dropHint="Batch convert PNGs to compact JPG files — transparent areas get the background colour you pick (white by default)"
    />
  );
}
