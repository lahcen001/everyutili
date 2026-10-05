"use client";

import ImageConvertTool from "@/components/tools/media/ImageConvertTool";

export default function SvgToJpg() {
  return (
    <ImageConvertTool
      slug="svg-to-jpg"
      output="jpeg"
      accept="image/svg+xml,.svg"
      matches={(f) => f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")}
      defaultQuality={0.9}
      dropLabel="Drag & drop SVG files here, or click to browse"
      dropHint="Batch rasterize vector icons to JPG — transparent areas get the background colour you pick"
      svg
    />
  );
}
