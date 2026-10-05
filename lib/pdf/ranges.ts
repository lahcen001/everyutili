/**
 * Parses a page selection like "1-3, 5, 8-" (1-based, "8-" = 8 to the end, "-3" = 1 to 3)
 * into sorted unique page numbers. Blank input means every page.
 */
export function parsePageRanges(input: string, pageCount: number): { pages: number[]; error?: string } {
  const text = input.trim();
  if (text === "") return { pages: Array.from({ length: pageCount }, (_, i) => i + 1) };

  const selected = new Set<number>();
  for (const rawPart of text.split(",")) {
    const part = rawPart.trim();
    if (part === "") continue;
    const match = /^(\d*)\s*(-)?\s*(\d*)$/.exec(part);
    if (!match || (match[1] === "" && match[3] === "")) {
      return { pages: [], error: `"${part}" isn't a valid page or range.` };
    }
    const hasDash = match[2] !== undefined;
    const start = match[1] === "" ? 1 : Number(match[1]);
    const end = hasDash ? (match[3] === "" ? pageCount : Number(match[3])) : start;
    if (start < 1 || end < 1) return { pages: [], error: "Page numbers start at 1." };
    if (start > end) return { pages: [], error: `"${part}" goes backwards — write it as ${end}-${start}.` };
    if (start > pageCount) return { pages: [], error: `Page ${start} doesn't exist — this PDF has ${pageCount} pages.` };
    for (let page = start; page <= Math.min(end, pageCount); page++) selected.add(page);
  }

  if (selected.size === 0) return { pages: [], error: "No pages selected." };
  return { pages: [...selected].sort((a, b) => a - b) };
}

/** Like parsePageRanges, but each comma-separated part stays its own group ("1-3, 5" → [[1,2,3],[5]]). */
export function parsePageRangeGroups(input: string, pageCount: number): { groups: number[][]; error?: string } {
  if (input.trim() === "") return { groups: [], error: "Enter the pages to extract, for example 1-3, 5, 8-." };
  const groups: number[][] = [];
  for (const part of input.split(",")) {
    if (part.trim() === "") continue;
    const parsed = parsePageRanges(part, pageCount);
    if (parsed.error) return { groups: [], error: parsed.error };
    groups.push(parsed.pages);
  }
  return groups.length > 0 ? { groups } : { groups: [], error: "No pages selected." };
}

/** Consecutive chunks of `size` pages: (10, 4) → [[1-4],[5-8],[9,10]]. */
export function chunkPages(pageCount: number, size: number): number[][] {
  const step = Math.max(1, Math.floor(size));
  const chunks: number[][] = [];
  for (let start = 1; start <= pageCount; start += step) {
    chunks.push(Array.from({ length: Math.min(step, pageCount - start + 1) }, (_, i) => start + i));
  }
  return chunks;
}

/** Compact label for file names: [1,2,3,5,8,9,10] → "1-3_5_8-10". */
export function describePages(pages: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < pages.length) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    parts.push(j > i ? `${pages[i]}-${pages[j]}` : `${pages[i]}`);
    i = j + 1;
  }
  return parts.join("_");
}

export type PageInterval = [start: number, end: number];

/**
 * Parses "1-3, 5, 8-" into intervals without knowing the page count; an open end is Infinity.
 * Blank input means "no restriction" (empty intervals, no error).
 */
export function parsePageIntervals(input: string): { intervals: PageInterval[]; error?: string } {
  const text = input.trim();
  if (text === "") return { intervals: [] };
  const intervals: PageInterval[] = [];
  for (const rawPart of text.split(",")) {
    const part = rawPart.trim();
    if (part === "") continue;
    const match = /^(\d*)\s*(-)?\s*(\d*)$/.exec(part);
    if (!match || (match[1] === "" && match[3] === "")) return { intervals: [], error: `"${part}" isn't a valid page or range.` };
    const hasDash = match[2] !== undefined;
    const start = match[1] === "" ? 1 : Number(match[1]);
    const end = hasDash ? (match[3] === "" ? Infinity : Number(match[3])) : start;
    if (start < 1) return { intervals: [], error: "Page numbers start at 1." };
    if (start > end) return { intervals: [], error: `"${part}" goes backwards.` };
    intervals.push([start, end]);
  }
  return { intervals };
}

/** True when `page` is in the intervals, or when there are none (no restriction). */
export function pageAllowed(page: number, intervals: PageInterval[]): boolean {
  return intervals.length === 0 || intervals.some(([start, end]) => page >= start && page <= end);
}
