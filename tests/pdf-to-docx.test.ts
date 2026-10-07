import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { bodyFontSize, itemsToPdfLines, linesToBlocks, looksScanned, stripRunningText, type PdfLine } from "@/lib/pdf/toDocx";
import type { PdfTextItem } from "@/lib/pdf/text";

const line = (text: string, y: number, size = 12, x = 50): PdfLine => ({ text, x, y, size });
const text = (b: ReturnType<typeof linesToBlocks>[number]) => ("runs" in b ? b.runs.map((r) => r.text).join("") : "");

describe("linesToBlocks", () => {
  it("finds headings by size, merges wrapped heading lines, and joins paragraph lines", () => {
    const blocks = linesToBlocks([
      [
        line("Annual", 780, 28),
        line("Report", 748, 28),
        line("Introduction", 700, 18),
        line("This is the first line of a paragraph that wraps", 670),
        line("onto a second line and then ends here.", 656),
        line("A new paragraph after a clear gap.", 620),
      ],
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["heading", "heading", "paragraph", "paragraph"]);
    expect(text(blocks[0])).toBe("Annual Report");
    expect(blocks[0].type === "heading" && blocks[0].level).toBe(1);
    expect(blocks[1].type === "heading" && blocks[1].level).toBe(2);
    expect(text(blocks[2])).toBe("This is the first line of a paragraph that wraps onto a second line and then ends here.");
    expect(text(blocks[3])).toBe("A new paragraph after a clear gap.");
  });

  it("mends hyphenated line breaks", () => {
    const blocks = linesToBlocks([[line("An extra-ordinarily long docu-", 700), line("ment continues here.", 686)]]);
    expect(text(blocks[0])).toBe("An extra-ordinarily long document continues here.");
  });

  it("builds bullet and numbered lists, with wrapped item lines", () => {
    const blocks = linesToBlocks([
      [
        line("Shopping list:", 700),
        line("• Apples", 680, 12, 60),
        line("• Bananas from the", 666, 12, 60),
        line("market", 652, 12, 72),
        line("1. First step", 620, 12, 60),
        line("2. Second step", 606, 12, 60),
      ],
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "list"]);
    const bullets = blocks[1];
    expect(bullets.type === "list" && bullets.ordered).toBe(false);
    expect(bullets.type === "list" && bullets.items.map((i) => i.runs[0].text)).toEqual(["Apples", "Bananas from the market"]);
    expect(blocks[2].type === "list" && blocks[2].ordered).toBe(true);
  });

  it("splits paragraphs at a large vertical gap and keeps paragraphs across pages", () => {
    const blocks = linesToBlocks([
      [line("First paragraph ends.", 700), line("Second paragraph starts after a gap", 640), line("and runs to the bottom of the page and", 50)],
      [line("continues on the next page.", 760)],
    ]);
    expect(blocks.map(text)).toEqual(["First paragraph ends.", "Second paragraph starts after a gap", "and runs to the bottom of the page and continues on the next page."].slice(0, 3));
  });

  it("removes repeating headers, footers and page numbers", () => {
    const topics = ["alpha", "beta", "gamma", "delta"];
    const pages = topics.map((t, i) => [line("ACME Confidential", 800), line(`The ${t} section describes something different.`, 600), line(`Page ${i + 1}`, 30)]);
    const stripped = stripRunningText(pages);
    expect(stripped.every((p) => p.length === 1)).toBe(true);
    expect(linesToBlocks(pages).length).toBe(4);
    expect(linesToBlocks(pages, { removeRunningText: false }).length).toBeGreaterThan(4);
  });

  it("measures the body size and detects scans", () => {
    expect(bodyFontSize([[line("a long body line of text here", 1, 11), line("Title", 2, 30)]])).toBe(11);
    expect(looksScanned([[], []])).toBe(true);
    expect(looksScanned([[line("A real page of text that is long enough", 1)]])).toBe(false);
  });
});

describe("itemsToPdfLines", () => {
  const item = (str: string, x: number, y: number, size: number, width = 40): PdfTextItem => ({ str, transform: [size, 0, 0, size, x, y], width, height: size });
  it("groups items into lines with their size and left edge", () => {
    const lines = itemsToPdfLines([item("World", 100, 700, 12), item("Hello", 50, 700, 12), item("Title", 50, 750, 24)]);
    expect(lines).toEqual([
      { text: "Title", x: 50, y: 750, size: 24 },
      { text: "Hello World", x: 50, y: 700, size: 12 },
    ]);
  });
});

describe("end to end with a real PDF", () => {
  it("turns a generated PDF into headings and paragraphs", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    page.drawText("Big Title", { x: 50, y: 780, size: 28, font });
    page.drawText("Some body text that explains things", { x: 50, y: 740, size: 12, font });
    page.drawText("in two lines.", { x: 50, y: 726, size: 12, font });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: (await pdf.save()).slice() });
    const doc = await task.promise;
    const content = await (await doc.getPage(1)).getTextContent();
    const items = content.items.filter((it): it is typeof it & PdfTextItem => "str" in it).map((it) => ({ str: it.str, transform: it.transform, width: it.width, height: it.height }));
    await task.destroy();
    const blocks = linesToBlocks([itemsToPdfLines(items)]);
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph"]);
    expect(text(blocks[0])).toBe("Big Title");
    expect(text(blocks[1])).toBe("Some body text that explains things in two lines.");
  });
});
