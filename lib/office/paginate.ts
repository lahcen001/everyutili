export interface PageSlice {
  start: number;
  end: number;
}

/**
 * Splits a tall rendered document into page-height slices without cutting through content.
 * `breakPoints` are the y positions (px) where a break is allowed — typically the bottom edge of each
 * block, table row or list item. A slice ends at the last allowed break that still fits; only when a
 * single piece of content is taller than a page is it cut at the page boundary.
 */
export function paginate(totalHeight: number, pageHeight: number, breakPoints: number[]): PageSlice[] {
  if (totalHeight <= 0 || pageHeight <= 0) return [{ start: 0, end: Math.max(totalHeight, 0) }];
  const breaks = [...new Set(breakPoints.map((y) => Math.round(y)))].filter((y) => y > 0 && y < totalHeight).sort((a, b) => a - b);
  const slices: PageSlice[] = [];
  let start = 0;
  while (start < totalHeight - 0.5) {
    const limit = start + pageHeight;
    if (limit >= totalHeight) {
      slices.push({ start, end: totalHeight });
      break;
    }
    let end = limit;
    for (let i = breaks.length - 1; i >= 0; i--) {
      if (breaks[i] <= limit && breaks[i] > start + 1) {
        end = breaks[i];
        break;
      }
    }
    slices.push({ start, end });
    start = end;
  }
  return slices;
}
