"use client";

import ImageConvertTool from "@/components/tools/media/ImageConvertTool";

export default function SvgToPng() {
  return (
    <ImageConvertTool
      slug="svg-to-png"
      output="png"
      accept="image/svg+xml,.svg"
      matches={(f) => f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")}
      defaultQuality={1}
      dropLabel="Drag & drop SVG files here, or click to browse"
      dropHint="Batch rasterize vector icons and illustrations to PNG"
      svg
    />
  );
}
