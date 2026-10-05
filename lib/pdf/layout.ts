export type PageOrientation = "auto" | "portrait" | "landscape";

export interface FixedPageLayout {
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Places an image on a fixed-size page: the page is oriented (auto = follow the image's shape),
 * then the image is scaled to fit inside the margins and centered. Units are PDF points.
 * `portraitSize` is [short side, long side].
 */
export function fitImageToPage(
  imageWidth: number,
  imageHeight: number,
  portraitSize: readonly [number, number],
  orientation: PageOrientation,
  margin: number
): FixedPageLayout {
  const landscape = orientation === "auto" ? imageWidth > imageHeight : orientation === "landscape";
  const [shortSide, longSide] = portraitSize;
  const pageWidth = landscape ? longSide : shortSide;
  const pageHeight = landscape ? shortSide : longSide;
  const boxWidth = Math.max(1, pageWidth - margin * 2);
  const boxHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { pageWidth, pageHeight, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}
