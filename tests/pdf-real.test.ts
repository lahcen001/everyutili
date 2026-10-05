import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { itemsToLines, type PdfTextItem } from "@/lib/pdf/text";
import { formatNumeral, placeLabel } from "@/lib/pdf/pageNumbers";
import { normalizeAngle, visualToUser } from "@/lib/pdf/rotation";
import { watermarkPlacements } from "@/lib/pdf/watermark";

// 1×1 transparent PNG
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

async function extractPages(bytes: Uint8Array): Promise<string[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false });
  const pdf = await task.promise;
  const out: string[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter((it): it is typeof it & PdfTextItem => "str" in it).map((it) => ({ str: it.str, transform: it.transform, width: it.width, height: it.height }));
    out.push(itemsToLines(items));
  }
  await task.destroy();
  return out;
}

describe("real PDF round trips", () => {
  it("extracts lines in reading order from a generated PDF", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const p1 = pdf.addPage([400, 400]);
    p1.drawText("Second line of text", { x: 40, y: 300, size: 12, font });
    p1.drawText("First line, drawn after", { x: 40, y: 340, size: 12, font });
    p1.drawText("Hello", { x: 40, y: 200, size: 12, font });
    p1.drawText("world", { x: 90, y: 200, size: 12, font });
    const pages = await extractPages(await pdf.save());
    expect(pages[0]).toEqual(["First line, drawn after", "Second line of text", "Hello world"]);
  });

  it("numbers pages (including a rotated one) and the labels read back upright", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 3; i++) pdf.addPage([600, 800]).drawText(`Body ${i + 1}`, { x: 100, y: 400, size: 14, font });
    pdf.getPage(1).setRotation(degrees(90));
    pdf.getPages().forEach((page, index) => {
      const label = `Page ${formatNumeral(index + 1, "roman-upper")}`;
      const { width, height } = page.getSize();
      const p = placeLabel({ width, height, pageRotation: page.getRotation().angle, textWidth: font.widthOfTextAtSize(label, 10), position: "bottom-center", margin: 24 });
      page.drawText(label, { x: p.x, y: p.y, size: 10, font, color: rgb(0, 0, 0), rotate: degrees(p.rotation) });
    });
    const pages = await extractPages(await pdf.save());
    pages.forEach((lines, i) => expect(lines.join(" ")).toContain(`Page ${["I", "II", "III"][i]}`));
  });

  it("watermarks every page including rotated ones and the file still opens", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 3; i++) pdf.addPage([600, 800]).drawText(`Doc ${i + 1}`, { x: 100, y: 400, size: 14, font });
    pdf.getPage(0).setRotation(degrees(270));
    const image = await pdf.embedPng(PNG);
    let drawn = 0;
    pdf.getPages().forEach((page) => {
      const { width: W, height: H } = page.getSize();
      const R = normalizeAngle(page.getRotation().angle);
      const vw = R === 90 || R === 270 ? H : W;
      const vh = R === 90 || R === 270 ? W : H;
      for (const p of watermarkPlacements({ pageWidth: vw, pageHeight: vh, width: 200, height: 50, position: "tiled", rotation: 30 })) {
        const o = visualToUser(p.x, p.y, W, H, R);
        page.drawImage(image, { x: o.x, y: o.y, width: 200, height: 50, rotate: degrees(p.rotation + R), opacity: 0.3 });
        drawn++;
      }
    });
    const bytes = await pdf.save();
    expect(drawn).toBeGreaterThan(30);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(3);
    expect(reloaded.getPage(0).getRotation().angle).toBe(270);
    // original text survives the watermark pass
    expect((await extractPages(bytes))[2].join(" ")).toContain("Doc 3");
  });

  it("maps visual points to user space consistently across all four rotations", () => {
    // The visual bottom-left corner of a rotated page is the corresponding corner of the unrotated page.
    expect(visualToUser(0, 0, 600, 800, 0)).toEqual({ x: 0, y: 0 });
    expect(visualToUser(0, 0, 600, 800, 90)).toEqual({ x: 600, y: 0 });
    expect(visualToUser(0, 0, 600, 800, 180)).toEqual({ x: 600, y: 800 });
    expect(visualToUser(0, 0, 600, 800, 270)).toEqual({ x: 0, y: 800 });
  });
});
