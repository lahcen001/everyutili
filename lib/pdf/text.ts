/** The parts of a pdf.js text item that matter for rebuilding lines. */
export interface PdfTextItem {
  str: string;
  /** PDF text matrix: [a, b, c, d, x, y]. */
  transform: number[];
  width: number;
  height?: number;
}

/**
 * Rebuilds reading-order text from pdf.js items: items are grouped into lines by their baseline, ordered
 * left to right, and joined with a space only where there is a visible gap. Returns lines top to bottom.
 */
export function itemsToLines(items: PdfTextItem[]): string[] {
  const usable = items.filter((item) => item.str !== "" && item.transform.length >= 6);
  if (usable.length === 0) return [];
  const sorted = [...usable].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);

  const lines: PdfTextItem[][] = [];
  for (const item of sorted) {
    const size = item.height || Math.abs(item.transform[3]) || 10;
    const current = lines[lines.length - 1];
    const lineY = current?.[0].transform[5];
    if (current && Math.abs(item.transform[5] - (lineY as number)) <= size * 0.4) current.push(item);
    else lines.push([item]);
  }

  return lines
    .map((line) => {
      const ordered = [...line].sort((a, b) => a.transform[4] - b.transform[4]);
      let text = "";
      let previousEnd: number | null = null;
      for (const item of ordered) {
        const size = item.height || Math.abs(item.transform[3]) || 10;
        if (previousEnd !== null && text !== "" && !text.endsWith(" ") && !item.str.startsWith(" ") && item.transform[4] - previousEnd > size * 0.15) text += " ";
        text += item.str;
        previousEnd = item.transform[4] + item.width;
      }
      return text.replace(/\s+$/g, "");
    })
    .filter((line) => line.trim() !== "");
}

/**
 * Joins hard-wrapped lines into paragraphs: a line ending without sentence punctuation continues into the
 * next one, and a hyphenated line break is mended. Lines that end a sentence or are short (headings) stay apart.
 */
export function reflowLines(lines: string[]): string {
  const paragraphs: string[] = [];
  let current = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    if (current === "") {
      current = line;
    } else if (/-$/.test(current) && /^[a-z]/.test(line)) {
      current = current.slice(0, -1) + line;
    } else {
      current += " " + line;
    }
    if (/[.!?:;)"”»]$/.test(line) || line.length < 40) {
      paragraphs.push(current);
      current = "";
    }
  }
  if (current !== "") paragraphs.push(current);
  return paragraphs.join("\n\n");
}
